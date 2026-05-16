/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BOOKING SOCKET SERVICE — Likeson.in  (PRODUCTION v4)
 * services/bookingSocketService.js
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UBER/RAPIDO/OLA LIVE-TRACKING PATTERN
 * ──────────────────────────────────────
 *
 *  Customer app   Driver app   Admin dashboard   TP dashboard
 *      │               │              │                │
 *      │ join booking  │ driver_loc   │ join admin:ops │ join tp:ABC
 *      ▼               ▼              ▼                ▼
 *  ┌─────────────────────────────────────────────────────────┐
 *  │                     Socket.IO Server                     │
 *  │  ROOMS:                                                  │
 *  │    booking:{id}   ← all parties for one booking         │
 *  │    driver:{id}    ← Driver._id (dispatch only)          │
 *  │    tp:{id}        ← transport partner ops               │
 *  │    admin:ops      ← admin/superadmin live feed           │
 *  └─────────────────────────────────────────────────────────┘
 *
 * KEY DESIGN DECISIONS (matches Uber):
 *  1. Ride.driver = Driver._id (NOT User._id). Resolved once at auth, cached.
 *  2. role strings use snake_case: 'care_assistant', 'solodriverpartner'
 *  3. OTP: single path — socket verify_otp event. HTTP /ride/start removed.
 *  4. Admin receives raw OTP via 'otp_for_admin' on admin:ops at driver arrival.
 *  5. ETA recalculated every 30s max (throttle), pushed to booking room.
 *  6. Map target: pickup → dropoff switch on OTP verify (single event).
 *  7. Canonical polyline never recalculated — read from RideTracking.expectedRoutePolyline.
 *  8. GPS errors never crash socket — always silent catch.
 *  9. declinedDrivers capped at model level ($slice). Socket respects that.
 * 10. etaThrottle + locationThrottle cleaned up on disconnect.
 * 11. Booking status auto-synced on every ride status transition via
 *     syncBookingStatusFromRide (bookingRouterShared). Single source of truth.
 *
 * CHANGES v4:
 *  - FIX: Removed floating try/catch block that was outside any class/function
 *    (was between canJoinRoom and class declaration — crashed entire module)
 *  - FIX: import path corrected to './bookingRouterShared.js'
 *  - ADD: syncBookingStatusFromRide called in driver_status_update after ride.save()
 *  - ADD: syncBookingStatusFromRide replaces manual Booking.findByIdAndUpdate in verify_otp
 *  - ADD: booking_status_change emitted to admin:ops on every sync
 *
 * GPS FLOW (every 2-5s from driver app):
 *  driver_location
 *    → rate-limit 2s (silent drop on excess)
 *    → validate coords
 *    → Driver.location update (geospatial dispatch index)
 *    → if solo: SoloDriverPartner.vehicle.lastKnownLocation update
 *    → if active booking:
 *        → Ride.liveLocation update
 *        → RideTracking.addBreadcrumb (ring buffer, max 2000)
 *        → every 30s: ETA recalc → addEtaUpdate → emit eta_update to room
 *    → emit location_update → booking room
 *    → emit driver_location → admin:ops
 *
 * STATUS FLOW (driver_status_update):
 *  → validate driver owns ride (Driver._id)
 *  → update Ride.status (pre-save sets timing fields automatically)
 *  → syncBookingStatusFromRide → Booking.status auto-updated
 *  → RideTracking.addMilestone
 *  → emit ride_status_changed → booking room + admin:ops
 *  → emit booking_status_change → booking room + admin:ops
 *  → if driver_arrived: emit otp_for_admin to admin:ops
 *  → if otp_verified/in_progress: emit navigation_target_changed → dropoff
 *
 * OTP FLOW (single path — verify_otp socket event):
 *  → verify hash
 *  → update Ride.status = 'otp_verified'
 *  → syncBookingStatusFromRide → Booking.status = 'in_progress'
 *  → emit navigation_target_changed → dropoff (ALL roles switch map)
 *  → emit ride_status_changed + booking_status_change
 *  → HTTP /ride/start endpoint REMOVED — socket is the only path
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Server } from 'socket.io';
import jwt        from 'jsonwebtoken';
import mongoose   from 'mongoose';

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

const LOCATION_THROTTLE_MS   = 2_000;  // 2s min between GPS pings per socket
const ETA_RECALC_THROTTLE_MS = 30_000; // 30s min between ETA recalcs per driver

const ACTIVE_RIDE_STATUSES = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived',  'otp_verified',    'in_progress', 'at_stop',
];

// After OTP verified, map switches from pickup → dropoff
const DROPOFF_TARGET_STATUSES = ['otp_verified', 'in_progress', 'at_stop'];

/**
 * Driver app sends these event keys → mapped to Ride.status enum values.
 */
const DRIVER_STATUS_MAP = {
  accepted:      'driver_accepted',
  en_route:      'driver_en_route',
  arrived:       'driver_arrived',
  otp_verified:  'otp_verified',
  ride_started:  'in_progress',
  at_stop:       'at_stop',
  stop_departed: 'in_progress',   // milestone is stop_departed, status stays in_progress
  completed:     'completed',
  cancelled:     'cancelled',
};

/**
 * Ride.status → primary RideTracking milestone name.
 */
const STATUS_MILESTONE_MAP = {
  driver_accepted: 'driver_accepted',
  driver_en_route: 'driver_en_route',
  driver_arrived:  'driver_arrived',
  otp_verified:    'otp_verified',
  in_progress:     'ride_started',
  at_stop:         'stop_reached',
  completed:       'ride_completed',
  cancelled:       'ride_cancelled',
};

/**
 * rawStatus → extra milestone (on top of primary).
 * stop_departed: maps to in_progress status but needs own milestone.
 */
const EXTRA_MILESTONE_MAP = {
  stop_departed: 'stop_departed',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const verifySocketToken = (token) => {
  try   { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * resolveDriverId
 * Given User._id + role → return Driver._id string.
 * Called once at auth, result cached on socket.user.driverObjectId.
 * All ride queries use Driver._id (Ride.driver field).
 */
const resolveDriverId = async (userId, role) => {
  if (!['driver', 'solodriverpartner'].includes(role)) return null;
  const driver = await Driver.findOne({ user: userId }).select('_id').lean();
  return driver ? driver._id.toString() : null;
};

/** Haversine km between two [lng, lat] pairs */
const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** pickup → dropoff map target logic (Uber pattern) */
const resolveMapTarget = (rideStatus) =>
  DROPOFF_TARGET_STATUSES.includes(rideStatus) ? 'dropoff' : 'pickup';

// ─────────────────────────────────────────────────────────────────────────────
// ROOM AUTHORIZATION
// DB-verified for every join. No trust on client-provided IDs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * canJoinRoom
 *
 * Rooms:
 *   "admin:ops"          → admin / superadmin only
 *   "driver:{driverId}"  → that Driver._id + admin
 *   "tp:{tpId}"          → that TP manager + admin
 *   "booking:{bookingId}"→ customer / assigned driver / CA / TP / admin
 */
const canJoinRoom = async (user, room) => {
  const { _id: userId, role, driverObjectId } = user;

  // ── admin:ops ─────────────────────────────────────────────────────────────
  if (room === 'admin:ops') {
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };
    return { allowed: false, reason: 'Admin only' };
  }

  // ── driver:{driverId} ─────────────────────────────────────────────────────
  if (room.startsWith('driver:')) {
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };
    const roomDriverId = room.replace('driver:', '');
    if (!isValidId(roomDriverId)) return { allowed: false, reason: 'Invalid driver ID' };
    if (!['driver', 'solodriverpartner'].includes(role)) return { allowed: false, reason: 'Driver only' };
    const myDriverId = driverObjectId || (await resolveDriverId(userId, role));
    if (!myDriverId || myDriverId !== roomDriverId) return { allowed: false, reason: 'Not your driver room' };
    return { allowed: true };
  }

  // ── tp:{tpId} ─────────────────────────────────────────────────────────────
  if (room.startsWith('tp:')) {
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };
    if (role !== 'transportpartner') return { allowed: false, reason: 'TP or admin only' };
    const tpId = room.replace('tp:', '');
    if (!isValidId(tpId)) return { allowed: false, reason: 'Invalid TP ID' };
    const tp = await TransportPartner.findOne({ _id: tpId, user: userId }).select('_id').lean();
    if (!tp) return { allowed: false, reason: 'Not your TP' };
    return { allowed: true };
  }

  // ── booking:{bookingId} ───────────────────────────────────────────────────
  if (room.startsWith('booking:')) {
    const bookingId = room.replace('booking:', '');
    if (!isValidId(bookingId)) return { allowed: false, reason: 'Invalid booking ID' };
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };

    const booking = await Booking.findById(bookingId)
      .select('customer transportPartner careAssistant').lean();
    if (!booking) return { allowed: false, reason: 'Booking not found' };

    // Customer
    if (booking.customer?.toString() === userId) return { allowed: true };

    // Driver — Ride.driver = Driver._id (driverObjectId)
    if (['driver', 'solodriverpartner'].includes(role)) {
      const dId = driverObjectId || (await resolveDriverId(userId, role));
      if (dId) {
        const ride = await Ride.findOne({ booking: bookingId, driver: dId }).select('_id').lean();
        if (ride) return { allowed: true };
      }
    }

    // Care assistant
    if (role === 'care_assistant') {
      const ca = await CareAssistantProfile.findOne({ user: userId }).select('_id').lean();
      if (ca && booking.careAssistant?.toString() === ca._id.toString()) return { allowed: true };
    }

    // Transport partner
    if (role === 'transportpartner') {
      const tp = await TransportPartner.findOne({ user: userId }).select('_id').lean();
      if (tp && booking.transportPartner?.toString() === tp._id.toString()) return { allowed: true };
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
     * connectedClients
     * Map<socketId, {
     *   userId:         string,       ← User._id
     *   driverObjectId: string|null,  ← Driver._id (resolved once at auth)
     *   role:           string,
     *   name:           string,
     *   joinedRooms:    Set<string>,
     *   connectedAt:    Date
     * }>
     */
    this.connectedClients = new Map();

    /** GPS rate limiter: Map<socketId, lastTimestamp> */
    this.locationThrottle = new Map();

    /** ETA recalc rate limiter: Map<socketId, lastTimestamp> */
    this.etaThrottle = new Map();
  }

  // ── Public emit helpers ────────────────────────────────────────────────────

  emitToRoom(room, event, payload) {
    this.io.to(room).emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToSocket(socketId, event, payload) {
    this.io.to(socketId).emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToAdminOps(event, payload) {
    this.emitToRoom('admin:ops', event, payload);
  }

  emitToUser(userId, event, payload) {
    for (const id of this.getSocketIdsByUser(String(userId))) {
      this.emitToSocket(id, event, payload);
    }
  }

  /**
   * emitJoinRoom — server-side force-join (called from routers after assignment).
   * No client join event needed.
   */
  emitJoinRoom(userId, room) {
    const socketIds = this.getSocketIdsByUser(String(userId));
    if (!socketIds.length) return;

    for (const id of socketIds) {
      this.io.in(id).socketsJoin(room);
      this.connectedClients.get(id)?.joinedRooms.add(room);
      console.log(`[Socket] Server-joined ${id} (${userId}) → ${room}`);
    }

    if (room.startsWith('booking:')) {
      const meta = this.connectedClients.get(socketIds[0]);
      if (meta) {
        this.io.to(room).emit('participant_joined', {
          role: meta.role, name: meta.name, timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * emitOtpToAdmin — called from route handler (/:id/ride/arrived).
   * Admin/superadmin see raw OTP in admin:ops room for support purposes.
   */
  emitOtpToAdmin({ bookingId, bookingCode, rideId, otp, customerName, customerPhone }) {
    this.emitToAdminOps('otp_for_admin', {
      bookingId, bookingCode, rideId, otp,
      customerName, customerPhone,
      note:      'Driver arrived. OTP sent to customer via SMS/email/push.',
      timestamp: new Date().toISOString(),
    });
  }

  // ── Socket setup ───────────────────────────────────────────────────────────

  /**
   * @param {import('socket.io').Socket} socket
   * @param {{ _id: string, role: string, name: string, driverObjectId: string|null }} user
   */
  setupSocket(socket, user) {
    const { _id: userId, role, name, driverObjectId } = user;

    this.connectedClients.set(socket.id, {
      userId, driverObjectId, role, name,
      joinedRooms: new Set(),
      connectedAt: new Date(),
    });

    console.log(`[Socket] Connected: ${name} (${role}) sid=${socket.id} driverId=${driverObjectId}`);

    // Auto-join admin:ops for admin/superadmin
    if (['admin', 'superadmin'].includes(role)) {
      socket.join('admin:ops');
      this.connectedClients.get(socket.id)?.joinedRooms.add('admin:ops');
    }

    // Auto-join driver:{id} room for drivers
    if (driverObjectId) {
      const driverRoom = `driver:${driverObjectId}`;
      socket.join(driverRoom);
      this.connectedClients.get(socket.id)?.joinedRooms.add(driverRoom);
      this.io.to('admin:ops').emit('driver_online', {
        userId, driverObjectId, role, name, timestamp: new Date().toISOString(),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: join_booking_room
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('join_booking_room', async ({ bookingId } = {}) => {
      try {
        if (!bookingId) { socket.emit('error', { message: 'bookingId required' }); return; }
        const room = `booking:${bookingId}`;
        const { allowed, reason } = await canJoinRoom({ _id: userId, role, driverObjectId }, room);
        if (!allowed) { socket.emit('error', { message: reason || 'Cannot join room' }); return; }
        socket.join(room);
        this.connectedClients.get(socket.id)?.joinedRooms.add(room);
        socket.emit('joined_room', { room, bookingId, _serverTime: new Date().toISOString() });
        socket.to(room).emit('participant_joined', { role, name, bookingId, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('[join_booking_room]', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: join_tp_room
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('join_tp_room', async ({ tpId } = {}) => {
      try {
        if (!tpId) { socket.emit('error', { message: 'tpId required' }); return; }
        const room = `tp:${tpId}`;
        const { allowed, reason } = await canJoinRoom({ _id: userId, role, driverObjectId }, room);
        if (!allowed) { socket.emit('error', { message: reason || 'Cannot join TP room' }); return; }
        socket.join(room);
        this.connectedClients.get(socket.id)?.joinedRooms.add(room);
        socket.emit('joined_room', { room, tpId, _serverTime: new Date().toISOString() });
      } catch (err) {
        console.error('[join_tp_room]', err);
        socket.emit('error', { message: 'Failed to join TP room' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: driver_location — CORE GPS EVENT (Uber-style)
    //
    // Payload: { bookingId?, lat, lng, heading?, speed?, accuracy? }
    //
    // Full flow:
    //  1.  2s rate-limit — silent drop on excess
    //  2.  Validate coords + role
    //  3.  Driver.location update (geospatial dispatch index)
    //  4.  SoloDriverPartner.vehicle.lastKnownLocation (solo only)
    //  5.  Find active ride by Driver._id (not User._id)
    //  6.  Ride.liveLocation update (fast read for customer)
    //  7.  RideTracking.addBreadcrumb (ring buffer 2000)
    //  8.  Every 30s: ETA recalc → addEtaUpdate → emit eta_update to booking room
    //      - Target = pickup (before OTP) or dropoff (during trip) — Uber pattern
    //  9.  emit location_update → booking room (customer pin moves)
    // 10.  emit driver_location → admin:ops (ops dashboard map)
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('driver_location', async ({ bookingId, lat, lng, heading, speed, accuracy } = {}) => {
      try {
        // 1. Rate limit
        const now  = Date.now();
        const last = this.locationThrottle.get(socket.id) ?? 0;
        if (now - last < LOCATION_THROTTLE_MS) return;
        this.locationThrottle.set(socket.id, now);

        // 2. Validate
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
        if (!['driver', 'solodriverpartner'].includes(role)) return;

        const coords = [lng, lat]; // GeoJSON: [lng, lat]

        // 3. Driver geospatial index update
        await Driver.findOneAndUpdate({ user: userId }, {
          'location.type':        'Point',
          'location.coordinates': coords,
          'location.heading':     heading ?? 0,
          'location.speedKmh':    speed   ?? 0,
          'location.updatedAt':   new Date(),
        });

        // 4. Solo driver vehicle location
        if (role === 'solodriverpartner') {
          await SoloDriverPartner.findOneAndUpdate({ user: userId }, {
            'vehicle.lastKnownLocation.type':        'Point',
            'vehicle.lastKnownLocation.coordinates': coords,
            'vehicle.lastLocationUpdatedAt':          new Date(),
          });
        }

        // 5-9. Ride tracking — only if active booking
        if (bookingId && isValidId(bookingId) && driverObjectId) {
          const ride = await Ride.findOne({
            booking: bookingId,
            driver:  driverObjectId, // ← Driver._id (not User._id)
            status:  { $in: ACTIVE_RIDE_STATUSES },
          }).select('_id trackingId status pickup dropoff estimatedDistanceKm').lean();

          if (ride) {
            // 6. Ride.liveLocation — fast denormalized read
            await Ride.findByIdAndUpdate(ride._id, {
              liveLocation: {
                type: 'Point', coordinates: coords,
                heading: heading ?? 0, speedKmh: speed ?? 0, updatedAt: new Date(),
              },
            });

            // 7. Breadcrumb ring buffer
            if (ride.trackingId) {
              RideTracking.addBreadcrumb(ride._id, {
                coordinates: coords, heading: heading ?? 0,
                speedKmh: speed ?? 0, accuracyM: accuracy ?? null, source: 'gps',
              }).catch(e => console.error('[GPS] breadcrumb:', e.message));
            }

            // 8. ETA recalc (throttled 30s)
            const lastEta = this.etaThrottle.get(socket.id) ?? 0;
            if (now - lastEta > ETA_RECALC_THROTTLE_MS) {
              this.etaThrottle.set(socket.id, now);

              const mapTarget    = resolveMapTarget(ride.status);
              const targetCoords = mapTarget === 'dropoff'
                ? ride.dropoff?.coordinates
                : ride.pickup?.coordinates;

              if (targetCoords) {
                const remainingKm = +haversineKm(coords, targetCoords).toFixed(2);
                const speedKmh    = (speed && speed > 2) ? speed : 30;
                const etaMin      = Math.round((remainingKm / speedKmh) * 60);

                if (ride.trackingId) {
                  RideTracking.addEtaUpdate(ride._id, {
                    toWaypoint: mapTarget, etaMinutes: etaMin,
                    distanceRemainingKm: remainingKm, source: 'estimate',
                  }).catch(e => console.error('[GPS] etaUpdate:', e.message));
                }

                // Push ETA to booking room (customer countdown)
                this.io.to(`booking:${bookingId}`).emit('eta_update', {
                  etaMinutes: etaMin, distanceRemainingKm: remainingKm,
                  currentTarget: mapTarget, _serverTime: new Date().toISOString(),
                });
              }
            }

            // 9. Live location to booking room
            this.io.to(`booking:${bookingId}`).emit('location_update', {
  lat, lng, heading, speed, accuracy,
  rideId,           // ← ADD
  bookingId,        // ← ADD
  role, rideStatus,
  currentTarget: resolveMapTarget(ride.status),
  updatedAt: new Date().toISOString(),
});
          }
        }

        // 10. Always push to admin:ops ops dashboard
        this.io.to('admin:ops').emit('driver_location', {
          userId, driverObjectId, name, role, lat, lng,
          heading: heading ?? 0, speed: speed ?? 0,
          bookingId: bookingId || null, updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        // GPS errors NEVER crash socket
        console.error('[driver_location]', err.message);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: care_location — Care assistant GPS ping
    // Payload: { bookingId?, lat, lng }
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('care_location', async ({ bookingId, lat, lng } = {}) => {
      try {
        if (role !== 'care_assistant') return;
        const now  = Date.now();
        const last = this.locationThrottle.get(socket.id) ?? 0;
        if (now - last < LOCATION_THROTTLE_MS) return;
        this.locationThrottle.set(socket.id, now);

        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

        await CareAssistantProfile.findOneAndUpdate({ user: userId }, {
          'location.type':        'Point',
          'location.coordinates': [lng, lat],
          'location.updatedAt':   new Date(),
        });

        if (bookingId && isValidId(bookingId)) {
          this.io.to(`booking:${bookingId}`).emit('location_update', {
            lat, lng, role: 'care_assistant', updatedAt: new Date().toISOString(),
          });
          this.io.to('admin:ops').emit('care_assistant_location', {
            userId, name, lat, lng, bookingId, updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[care_location]', err.message);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: driver_status_update — Uber "I've arrived", "Start trip" etc.
    //
    // Payload: { bookingId, rideId, status (key in DRIVER_STATUS_MAP),
    //            lat?, lng?, meta? }
    //
    // NOTE: 'arrived' status triggers otp_for_admin to admin:ops
    //       'otp_verified'/'in_progress' triggers navigation_target_changed
    //       ALL status transitions auto-sync Booking.status via shared helper
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('driver_status_update', async ({ bookingId, rideId, status, lat, lng, meta } = {}) => {
      try {
        if (!['driver', 'solodriverpartner'].includes(role)) return;
        if (!bookingId || !rideId || !status) {
          socket.emit('error', { message: 'bookingId, rideId, status required' }); return;
        }
        if (!isValidId(bookingId) || !isValidId(rideId)) {
          socket.emit('error', { message: 'Invalid IDs' }); return;
        }
        if (!driverObjectId) {
          socket.emit('error', { message: 'Driver profile not found' }); return;
        }

        const mappedStatus = DRIVER_STATUS_MAP[status];
        if (!mappedStatus) {
          socket.emit('error', { message: `Unknown status: ${status}` }); return;
        }

        // Query ride using Driver._id (driverObjectId)
        const ride = await Ride.findOne({
          _id:     rideId,
          booking: bookingId,
          driver:  driverObjectId, // ← Driver._id
        }).select('_id status trackingId updatedBy pickup dropoff');

        if (!ride) {
          socket.emit('error', { message: 'Ride not found or not yours' }); return;
        }

        const rawStatus = status;
        ride.status    = mappedStatus;
        ride.updatedBy = userId;
        await ride.save(); // pre-save hook auto-sets timing fields

        // ── AUTO-SYNC Booking.status from ride status ─────────────────────
        // Single source of truth — no manual Booking.findByIdAndUpdate here.
        try {
          const { syncBookingStatusFromRide } = await import('./bookingRouterShared.js');
          const updatedBooking = await syncBookingStatusFromRide(bookingId, mappedStatus, userId);
          if (updatedBooking) {
            this.io.to(`booking:${bookingId}`).emit('booking_status_change', {
              bookingId,
              status:    updatedBooking.status,
              source:    'ride_status_sync',
              timestamp: new Date().toISOString(),
            });
            this.io.to('admin:ops').emit('booking_status_change', {
              bookingId,
              status:     updatedBooking.status,
              rideStatus: mappedStatus,
              driverName: name,
              timestamp:  new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error('[driver_status_update] booking sync failed:', e.message);
        }

        // ── Primary milestone ─────────────────────────────────────────────
        const milestoneName = STATUS_MILESTONE_MAP[mappedStatus];
        if (milestoneName && ride.trackingId) {
          RideTracking.addMilestone(ride._id, milestoneName, {
            coordinates: lat && lng ? [lng, lat] : null,
            meta: meta ?? null, recordedBy: 'driver', recordedByUserId: userId,
          }).catch(e => console.error('[status_update] milestone:', e.message));
        }

        // ── Extra milestone for stop_departed ─────────────────────────────
        if (EXTRA_MILESTONE_MAP[rawStatus] && ride.trackingId) {
          RideTracking.addMilestone(ride._id, EXTRA_MILESTONE_MAP[rawStatus], {
            coordinates: lat && lng ? [lng, lat] : null,
            meta: meta ?? null, recordedBy: 'driver', recordedByUserId: userId,
          }).catch(e => console.error('[status_update] extra milestone:', e.message));
        }

        const statusPayload = {
          bookingId, rideId, status: mappedStatus, rawStatus,
          driverObjectId, driverName: name,
          lat: lat ?? null, lng: lng ?? null,
          currentTarget: resolveMapTarget(mappedStatus),
          updatedAt: new Date().toISOString(),
        };

        this.io.to(`booking:${bookingId}`).emit('ride_status_changed', statusPayload);
        this.io.to('admin:ops').emit('ride_status_changed', statusPayload);

        // ── Driver arrived → admin OTP flag ──────────────────────────────
        if (mappedStatus === 'driver_arrived') {
          this.emitToAdminOps('otp_for_admin', {
            bookingId, rideId, driverName: name,
            note:      'Driver arrived — OTP dispatched to customer via SMS/email/push',
            timestamp: new Date().toISOString(),
          });
        }

        // ── Navigation target switches to dropoff ─────────────────────────
        if (['otp_verified', 'in_progress'].includes(mappedStatus)) {
          const rideDoc = await Ride.findById(rideId)
            .select('dropoff trackingId').lean();
          const trackingDoc = rideDoc?.trackingId
            ? await RideTracking.findById(rideDoc.trackingId)
                .select('expectedRoutePolyline').lean()
            : null;

          this.io.to(`booking:${bookingId}`).emit('navigation_target_changed', {
            bookingId, rideId, currentTarget: 'dropoff',
            coords:   rideDoc?.dropoff?.coordinates,
            address:  rideDoc?.dropoff?.address,
            polyline: trackingDoc?.expectedRoutePolyline || null,
            _serverTime: new Date().toISOString(),
          });
        }

        socket.emit('status_update_ack', { rideId, status: mappedStatus, _serverTime: new Date().toISOString() });
        console.log(`[Socket] ${name} → ${mappedStatus} (ride ${rideId})`);
      } catch (err) {
        console.error('[driver_status_update]', err);
        socket.emit('error', { message: 'Status update failed' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: verify_otp — SOLE OTP VERIFICATION PATH
    //
    // Payload: { bookingId, rideId, otp }
    //
    // This is the ONLY place OTP verification happens.
    // HTTP POST /:id/ride/start is removed — it was a duplicate path.
    //
    // On success:
    //  - Ride.status → 'otp_verified'
    //  - RideTracking milestones: otp_verified + ride_started
    //  - Booking.status → 'in_progress' via syncBookingStatusFromRide
    //  - Emit navigation_target_changed → dropoff for ALL roles
    //  - Admin:ops notified
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('verify_otp', async ({ bookingId, rideId, otp } = {}) => {
      try {
        if (!['driver', 'solodriverpartner'].includes(role)) return;
        if (!bookingId || !rideId || !otp) {
          socket.emit('otp_result', { success: false, message: 'Missing fields' }); return;
        }
        if (!driverObjectId) {
          socket.emit('otp_result', { success: false, message: 'Driver not found' }); return;
        }

        const ride = await Ride.findOne({
          _id:     rideId,
          booking: bookingId,
          driver:  driverObjectId, // ← Driver._id
          status:  'driver_arrived',
        }).select('+pickupOtp trackingId dropoff');

        if (!ride) {
          socket.emit('otp_result', { success: false, message: 'Ride not ready for OTP' }); return;
        }

        // Hash comparison (OTP_SECRET consistent with hashOtp in shared)
        const crypto = await import('crypto');
        const hash   = crypto.createHmac('sha256', process.env.OTP_SECRET || 'likeson-otp-secret')
          .update(String(otp)).digest('hex');

        if (hash !== ride.pickupOtp) {
  socket.emit('otp_result', { success: false, message: 'Invalid OTP' });
  this.io.to(`booking:${bookingId}`).emit('otp_wrong_attempt', {
    bookingId, timestamp: new Date().toISOString(),
  });
  this.emitToAdminOps('otp_failed_attempt', {
    bookingId, rideId, driverObjectId, driverName: name,
    timestamp: new Date().toISOString(),
  });
  return;
}

        // OTP valid — transition to otp_verified
        ride.status              = 'otp_verified';
        ride.pickupOtpVerifiedAt = new Date();
        ride.updatedBy           = userId;
        await ride.save(); // pre-save sets rideStartedAt

        // ── AUTO-SYNC Booking.status → 'in_progress' ─────────────────────
        // Replaces manual Booking.findByIdAndUpdate — single source of truth.
        try {
          const { syncBookingStatusFromRide } = await import('./bookingRouterShared.js');
          await syncBookingStatusFromRide(bookingId, 'otp_verified', userId);
        } catch (e) {
          // Fallback: direct update if shared import fails
          console.error('[verify_otp] syncBookingStatusFromRide failed, using fallback:', e.message);
          await Booking.findByIdAndUpdate(bookingId, {
            $set: { status: 'in_progress', updatedBy: userId },
          });
        }

        // ── Milestones ────────────────────────────────────────────────────
        if (ride.trackingId) {
          await Promise.all([
            RideTracking.addMilestone(ride._id, 'otp_verified', { recordedBy: 'driver', recordedByUserId: userId }),
            RideTracking.addMilestone(ride._id, 'ride_started', { recordedBy: 'driver', recordedByUserId: userId }),
          ]).catch(() => {});

          // Update tracking driver field if needed
          await RideTracking.findByIdAndUpdate(ride.trackingId, { $set: { driver: driverObjectId } });
        }

        // Fetch locked canonical polyline
        const trackingDoc = ride.trackingId
          ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
          : null;

        const successPayload = { bookingId, rideId, status: 'otp_verified', verifiedAt: new Date().toISOString() };

        socket.emit('otp_result', { success: true, ...successPayload });

        // ALL roles switch map to dropoff immediately
        this.io.to(`booking:${bookingId}`).emit('navigation_target_changed', {
          bookingId, rideId, currentTarget: 'dropoff',
          coords:   ride.dropoff?.coordinates,
          address:  ride.dropoff?.address,
          polyline: trackingDoc?.expectedRoutePolyline || null, // same canonical polyline for all
          _serverTime: new Date().toISOString(),
        });

        this.io.to(`booking:${bookingId}`).emit('ride_status_changed', {
          ...successPayload, driverObjectId, driverName: name, currentTarget: 'dropoff',
        });

        this.io.to(`booking:${bookingId}`).emit('booking_status_change', {
          bookingId, status: 'in_progress', source: 'otp_verified', timestamp: new Date().toISOString(),
        });

        this.io.to('admin:ops').emit('ride_status_changed', { ...successPayload, driverName: name });
        this.io.to('admin:ops').emit('booking_status_change', {
          bookingId, status: 'in_progress', rideStatus: 'otp_verified',
          driverName: name, timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] OTP verified: ride ${rideId} booking ${bookingId}`);
      } catch (err) {
        console.error('[verify_otp]', err);
        socket.emit('otp_result', { success: false, message: 'OTP verification failed' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: sos_trigger — Emergency SOS from driver or customer
    // Payload: { bookingId, rideId, lat?, lng?, sosType, description? }
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('sos_trigger', async ({ bookingId, rideId, lat, lng, sosType, description } = {}) => {
      try {
        if (!bookingId || !rideId) {
          socket.emit('error', { message: 'bookingId and rideId required' }); return;
        }

        const { allowed } = await canJoinRoom({ _id: userId, role, driverObjectId }, `booking:${bookingId}`);
        if (!allowed) { socket.emit('error', { message: 'Access denied' }); return; }

        const ride = await Ride.findOne({ _id: rideId, booking: bookingId }).select('_id trackingId').lean();
        if (!ride) { socket.emit('error', { message: 'Ride not found' }); return; }

        if (ride.trackingId) {
          await RideTracking.triggerSos(ride._id, {
            triggeredBy: role, triggeredByUserId: userId,
            sosType: sosType || 'other',
            coordinates: lat && lng ? [lng, lat] : null,
            description: description || null,
          });
          await RideTracking.addMilestone(ride._id, 'sos_triggered', {
            coordinates: lat && lng ? [lng, lat] : null,
            meta: { sosType, triggeredBy: role },
            recordedBy: ['driver', 'solodriverpartner'].includes(role) ? 'driver' : 'customer',
            recordedByUserId: userId,
          });
        }

        const sosPayload = {
          bookingId, rideId, triggeredBy: role, triggeredName: name,
          sosType: sosType || 'other', lat: lat ?? null, lng: lng ?? null,
          description: description || null, timestamp: new Date().toISOString(),
        };

        this.io.to(`booking:${bookingId}`).emit('sos_alert', sosPayload);
        this.io.to('admin:ops').emit('sos_alert', sosPayload);
        socket.emit('sos_ack', { received: true, timestamp: new Date().toISOString() });
        console.warn(`[SOS] ${name} (${role}) → booking ${bookingId}`);
      } catch (err) {
        console.error('[sos_trigger]', err);
        socket.emit('error', { message: 'SOS trigger failed' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: route_deviation — off-route detected (system or driver reports)
    // Payload: { bookingId, rideId, lat, lng, deviationKm, driverReason? }
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('route_deviation', async ({ bookingId, rideId, lat, lng, deviationKm, driverReason } = {}) => {
      try {
        if (!bookingId || !rideId) return;
        const ride = await Ride.findOne({ _id: rideId, booking: bookingId }).select('_id trackingId').lean();
        if (!ride) return;

        if (ride.trackingId) {
          await RideTracking.findOneAndUpdate({ ride: ride._id }, {
            $push: {
              routeDeviations: {
                detectedAt: new Date(), coordinates: lat && lng ? [lng, lat] : null,
                deviationKm: deviationKm ?? 0, wasAcknowledged: false,
                driverReason: driverReason || null,
              },
            },
            $set: { hasUnacknowledgedDeviation: true },
          });
          await RideTracking.addMilestone(ride._id, 'route_deviated', {
            coordinates: lat && lng ? [lng, lat] : null,
            meta: { deviationKm, driverReason },
            recordedBy: 'driver', recordedByUserId: userId,
          });
        }

        const payload = {
          bookingId, rideId, lat, lng, deviationKm,
          driverReason: driverReason || null, timestamp: new Date().toISOString(),
        };
        this.io.to(`booking:${bookingId}`).emit('route_deviation_alert', payload);
        this.io.to('admin:ops').emit('route_deviation_alert', payload);
      } catch (err) {
        console.error('[route_deviation]', err.message);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: otp_resend_request — Customer asks driver to re-show OTP screen
    // Payload: { bookingId }
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('otp_resend_request', async ({ bookingId } = {}) => {
      try {
        if (!bookingId || role !== 'customer') return;
        const { allowed } = await canJoinRoom({ _id: userId, role }, `booking:${bookingId}`);
        if (!allowed) return;
        socket.to(`booking:${bookingId}`).emit('otp_resend_requested', {
          bookingId, requestedBy: 'customer', timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[otp_resend_request]', err.message);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: request_booking_state — Client reconnected, needs full snapshot
    // Payload: { bookingId }
    //
    // Returns full state: booking status, active ride with live location,
    // map route (canonical polyline), ETA, milestones, SOS status.
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('request_booking_state', async ({ bookingId } = {}) => {
      try {
        if (!bookingId || !isValidId(bookingId)) {
          socket.emit('error', { message: 'Invalid bookingId' }); return;
        }
        const { allowed, reason } = await canJoinRoom({ _id: userId, role, driverObjectId }, `booking:${bookingId}`);
        if (!allowed) { socket.emit('error', { message: reason || 'Access denied' }); return; }

        const [booking, activeRide] = await Promise.all([
          Booking.findById(bookingId)
            .select('status scheduledAt bookingType patientInfo fareBreakdown').lean(),
          Ride.findOne({ booking: bookingId, status: { $in: ACTIVE_RIDE_STATUSES } })
            .select('status liveLocation driverSnapshot vehicleSnapshot trackingId currentEtaMinutes pickup dropoff estimatedDistanceKm estimatedDurationMin').lean(),
        ]);

        if (!booking) { socket.emit('error', { message: 'Booking not found' }); return; }

        let tracking = null;
        if (activeRide?.trackingId) {
          tracking = await RideTracking.findById(activeRide.trackingId)
            .select('currentEtaMinutes totalDistanceKm hasActiveSos milestones expectedRoutePolyline').lean();
        }

        socket.emit('booking_state_snapshot', {
          bookingId,
          bookingStatus: booking.status,
          ride: activeRide ? {
            status:            activeRide.status,
            currentTarget:     resolveMapTarget(activeRide.status),
            liveLocation:      activeRide.liveLocation,
            driverSnapshot:    activeRide.driverSnapshot,
            vehicleSnapshot:   activeRide.vehicleSnapshot,
            currentEtaMinutes: activeRide.currentEtaMinutes,
            pickup:            activeRide.pickup,
            dropoff:           activeRide.dropoff,
            estimatedDistKm:   activeRide.estimatedDistanceKm,
            estimatedMinutes:  activeRide.estimatedDurationMin,
          } : null,
          tracking: tracking ? {
            currentEtaMinutes:     tracking.currentEtaMinutes,
            totalDistanceKm:       tracking.totalDistanceKm,
            hasActiveSos:          tracking.hasActiveSos,
            lastMilestone:         tracking.milestones?.slice(-1)[0] ?? null,
            // Canonical polyline — same for all roles, locked at ride creation
            expectedRoutePolyline: tracking.expectedRoutePolyline,
          } : null,
          _serverTime: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[request_booking_state]', err);
        socket.emit('error', { message: 'Failed to fetch booking state' });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: leave_booking_room
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('leave_booking_room', ({ bookingId } = {}) => {
      if (!bookingId) return;
      const room = `booking:${bookingId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      socket.emit('left_room', { room, _serverTime: new Date().toISOString() });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: leave_tp_room
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('leave_tp_room', ({ tpId } = {}) => {
      if (!tpId) return;
      const room = `tp:${tpId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      socket.emit('left_room', { room, _serverTime: new Date().toISOString() });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: ping_health — keep-alive / latency check
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('ping_health', () => {
      socket.emit('pong_health', {
        serverTime:     new Date().toISOString(),
        connectedSince: this.connectedClients.get(socket.id)?.connectedAt,
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: disconnect
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const meta = this.connectedClients.get(socket.id);
      console.log(`[Socket] Disconnected: ${meta?.name || socket.id} (${meta?.role}) reason=${reason}`);

      // Clean up all throttle maps
      this.connectedClients.delete(socket.id);
      this.locationThrottle.delete(socket.id);
      this.etaThrottle.delete(socket.id);

      if (meta && ['driver', 'solodriverpartner'].includes(meta.role)) {
        this.io.to('admin:ops').emit('driver_offline', {
          userId: meta.userId, driverObjectId: meta.driverObjectId,
          role: meta.role, name: meta.name, timestamp: new Date().toISOString(),
        });
      }

      // Notify booking rooms
      if (meta?.joinedRooms) {
        for (const room of meta.joinedRooms) {
          if (room.startsWith('booking:')) {
            this.io.to(room).emit('participant_left', {
              role: meta.role, name: meta.name, timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT: error
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error(`[Socket error] ${socket.id}:`, err?.message ?? err);
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

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
      activeRooms:    Object.keys(rooms).length,
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
// INIT — call once from server.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * initBookingSocket — initialize singleton once after io is created.
 *
 * @example
 * // server.js
 * import http from 'http';
 * import { Server } from 'socket.io';
 * import { initBookingSocket } from './services/bookingSocketService.js';
 *
 * const httpServer = http.createServer(app);
 * const io = new Server(httpServer, {
 *   cors:         { origin: process.env.FRONTEND_URL, methods: ['GET','POST'] },
 *   pingTimeout:  60000,
 *   pingInterval: 25000,
 * });
 * initBookingSocket(io);
 * httpServer.listen(process.env.PORT || 5000);
 *
 * @param {import('socket.io').Server} io
 * @returns {BookingSocketService}
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

      if (!token) return next(new Error('AUTH_MISSING'));

      const decoded = verifySocketToken(token);
      const userId  = decoded?.id || decoded?._id;
      if (!userId)  return next(new Error('AUTH_INVALID'));

      const user = await User.findById(userId).select('name role isBlocked').lean();
      if (!user)          return next(new Error('AUTH_USER_NOT_FOUND'));
      if (user.isBlocked) return next(new Error('AUTH_BLOCKED'));

      // Resolve Driver._id ONCE at auth — cached on socket.user.driverObjectId.
      // Every GPS ping + ride query uses this cached value.
      let driverObjectId = null;
      if (['driver', 'solodriverpartner'].includes(user.role)) {
        driverObjectId = await resolveDriverId(userId.toString(), user.role);
        if (!driverObjectId) {
          console.warn(`[Socket Auth] No Driver doc for user ${userId} role ${user.role}`);
        }
      }

      socket.user = {
        _id:            userId.toString(),
        role:           user.role,
        name:           user.name,
        driverObjectId, // ← Driver._id; null for non-drivers
      };

      console.log(`[Socket Auth] OK: ${user.name} (${user.role}) driverId=${driverObjectId}`);
      next();
    } catch (err) {
      console.error('[Socket Auth]', err.message);
      next(new Error(`AUTH_ERROR: ${err.message}`));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    service.setupSocket(socket, socket.user);
  });

  io.on('error', (err) => {
    console.error('[Socket.io server error]', err.message);
  });

  console.log('[BookingSocket] Initialized ✅');
  return service;
};

// ─────────────────────────────────────────────────────────────────────────────
// GETTER — use in routers/controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getBookingSocketService — returns singleton or null if not init'd yet.
 * @returns {BookingSocketService|null}
 */
export const getBookingSocketService = () => _instance;

export { Server };