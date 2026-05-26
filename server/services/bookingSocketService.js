/**
 * bookingSocketService.js — Likeson.in (PRODUCTION v7)
 *
 * REFACTORED: All consultation socket logic REMOVED.
 * Consultation now lives in /consultation namespace via consultationSocketService.js
 *
 * This service handles ONLY:
 *   - Ride GPS tracking
 *   - Driver status updates
 *   - OTP verification
 *   - SOS alerts
 *   - Route deviation
 *   - Booking room joins (transport bookings only)
 *   - Transport partner rooms
 *   - Admin ops room
 */

import { Server } from 'socket.io';
import jwt         from 'jsonwebtoken';
import mongoose    from 'mongoose';

import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import Booking              from '../models/Booking.js';
import Ride                 from '../models/Ride.js';
import RideTracking         from '../models/RideTracking.js';
import TransportPartner     from '../models/TransportPartner.js';
import User                 from '../models/User.js';
import Hospital             from '../models/Hospital.js';
import {
  hashOtp,
  syncBookingStatusFromRide,
  calculateEtaMinutes,
} from '../routes/bookingRouterShared.js';

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

/** @type {BookingSocketService|null} */
let _instance = null;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LOCATION_THROTTLE_MS   = 2_000;
const ETA_RECALC_THROTTLE_MS = 30_000;

const ACTIVE_RIDE_STATUSES = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived',  'otp_verified',    'in_progress', 'at_stop',
];

const DROPOFF_TARGET_STATUSES = ['otp_verified', 'in_progress', 'at_stop'];

const DRIVER_STATUS_MAP = {
  accepted:      'driver_accepted',
  en_route:      'driver_en_route',
  arrived:       'driver_arrived',
  otp_verified:  'otp_verified',
  ride_started:  'in_progress',
  at_stop:       'at_stop',
  stop_departed: 'in_progress',
  completed:     'completed',
  cancelled:     'cancelled',
};

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

const EXTRA_MILESTONE_MAP = {
  stop_departed: 'stop_departed',
};

const CARE_ASSISTANT_LOCATION_EVENT =
  'care_assistant_location_update';
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const verifySocketToken = (token) => {
  try   { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const resolveDriverId = async (userId, role) => {
  if (!['driver', 'solodriverpartner'].includes(role)) return null;
  const driver = await Driver.findOne({ user: userId }).select('_id').lean();
  return driver ? driver._id.toString() : null;
};

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

const resolveMapTarget = (rideStatus) =>
  DROPOFF_TARGET_STATUSES.includes(rideStatus) ? 'dropoff' : 'pickup';

// ─────────────────────────────────────────────────────────────────────────────
// ROOM AUTHORIZATION — ride/transport rooms only
// ─────────────────────────────────────────────────────────────────────────────

const canJoinRoom = async (user, room) => {
  const { _id: userId, role, driverObjectId } = user;

  if (room === 'admin:ops' || room === 'admin:global') {
    return ['admin', 'superadmin'].includes(role)
      ? { allowed: true }
      : { allowed: false, reason: 'Admin only' };
  }

  if (room.startsWith('driver:')) {
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };
    const roomDriverId = room.replace('driver:', '');
    if (!isValidId(roomDriverId)) return { allowed: false, reason: 'Invalid driver ID' };
    if (!['driver', 'solodriverpartner'].includes(role)) return { allowed: false, reason: 'Driver only' };
    const myDriverId = driverObjectId || (await resolveDriverId(userId, role));
    if (!myDriverId || myDriverId !== roomDriverId)
      return { allowed: false, reason: 'Not your driver room' };
    return { allowed: true };
  }

  if (room.startsWith('user:')) {
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };
    const roomUserId = room.replace('user:', '');
    if (!isValidId(roomUserId)) return { allowed: false, reason: 'Invalid user ID' };
    if (userId !== roomUserId) return { allowed: false, reason: 'Not your user room' };
    return { allowed: true };
  }

  if (room.startsWith('tp:')) {
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };
    if (role !== 'transportpartner') return { allowed: false, reason: 'TP or admin only' };
    const tpId = room.replace('tp:', '');
    if (!isValidId(tpId)) return { allowed: false, reason: 'Invalid TP ID' };
    const tp = await TransportPartner.findOne({ _id: tpId, user: userId }).select('_id').lean();
    if (!tp) return { allowed: false, reason: 'Not your TP' };
    return { allowed: true };
  }

  // booking:{bookingId} — TRANSPORT BOOKINGS ONLY
  // NOTE: consultation bookings should use /consultation namespace instead.
  if (room.startsWith('booking:')) {
    const bookingId = room.replace('booking:', '');
    if (!isValidId(bookingId)) return { allowed: false, reason: 'Invalid booking ID' };
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };

    const booking = await Booking.findById(bookingId)
      .select('customer doctor transportPartner careAssistant bookingType')
      .lean();
    if (!booking) return { allowed: false, reason: 'Booking not found' };

    // Reject consultation bookings from ride namespace
    const CONSULTATION_TYPES = ['doctor_consultation', 'doctor_online', 'follow_up'];
    if (CONSULTATION_TYPES.includes(booking.bookingType)) {
      return { allowed: false, reason: 'Use /consultation namespace for consultation bookings' };
    }

    if (booking.customer?.toString() === userId) return { allowed: true };

    if (['driver', 'solodriverpartner'].includes(role)) {
      const dId = driverObjectId || (await resolveDriverId(userId, role));
      if (dId) {
        const ride = await Ride.findOne({ booking: bookingId, driver: dId }).select('_id').lean();
        if (ride) return { allowed: true };
      }
    }

   if (
  role === 'care_assistant' &&
  ride.booking
) {

  const ca =
    await CareAssistantProfile
      .findOne({
        user: userId,
      })
      .select('_id')
      .lean();

  if (ca) {

    const booking =
      await Booking.findById(
        ride.booking
      )
        .select('careAssistant')
        .lean();

    if (
      booking?.careAssistant
        ?.toString() ===
      ca._id.toString()
    ) {

      return {
        allowed: true,
        liveTracking: true,
        hospitalTracking: true,
      };
    }
  }
}

    if (role === 'transportpartner') {
      const tp = await TransportPartner.findOne({ user: userId }).select('_id').lean();
      if (tp && booking.transportPartner?.toString() === tp._id.toString())
        return { allowed: true };
    }

    return { allowed: false, reason: 'Not linked to this booking' };
  }

  return { allowed: false, reason: 'Unknown room format' };
};

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
    this.etaThrottle      = new Map();
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

  emitToAdmins(event, payload) {
    this.emitToRoom('admin:ops',    event, payload);
    this.emitToRoom('admin:global', event, payload);
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

  emitOtpToAdmin({ bookingId, bookingCode, rideId, otp, customerName, customerPhone }) {
    this.emitToAdminOps('otp_for_admin', {
      bookingId, bookingCode, rideId, otp,
      customerName, customerPhone,
      note:      'Driver arrived. OTP sent to customer via SMS/email/push.',
      timestamp: new Date().toISOString(),
    });
  }

  // ── Socket setup ───────────────────────────────────────────────────────────

  setupSocket(socket, user) {
    const { _id: userId, role, name, driverObjectId } = user;

    this.connectedClients.set(socket.id, {
      userId, driverObjectId, role, name,
      joinedRooms: new Set(),
      connectedAt: new Date(),
    });

    // Auto-join admin rooms
    if (['admin', 'superadmin'].includes(role)) {
      socket.join('admin:ops');
      socket.join('admin:global');
      this.connectedClients.get(socket.id)?.joinedRooms.add('admin:ops');
      this.connectedClients.get(socket.id)?.joinedRooms.add('admin:global');
    }

    // Driver personal room
    if (driverObjectId) {
      const driverRoom = `driver:${driverObjectId}`;
      socket.join(driverRoom);
      this.connectedClients.get(socket.id)?.joinedRooms.add(driverRoom);
      this.io.to('admin:ops').emit('driver_online', {
        userId, driverObjectId, role, name, timestamp: new Date().toISOString(),
      });
    }

    // Customer personal room
    if (role === 'customer') {
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      this.connectedClients.get(socket.id)?.joinedRooms.add(userRoom);
    }

    // ── join_booking_room — TRANSPORT ONLY ────────────────────────────────────
    socket.on('join_booking_room', async ({ bookingId } = {}) => {
      try {
        if (!bookingId) { socket.emit('error', { message: 'bookingId required' }); return; }
        const room = `booking:${bookingId}`;
        const { allowed, reason } = await canJoinRoom(
          { _id: userId, role, driverObjectId }, room
        );
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

    // ── join_tp_room ───────────────────────────────────────────────────────────
    socket.on('join_tp_room', async ({ tpId } = {}) => {
      try {
        if (!tpId) { socket.emit('error', { message: 'tpId required' }); return; }
        const room = `tp:${tpId}`;
        const { allowed, reason } = await canJoinRoom(
          { _id: userId, role, driverObjectId }, room
        );
        if (!allowed) { socket.emit('error', { message: reason || 'Cannot join TP room' }); return; }
        socket.join(room);
        this.connectedClients.get(socket.id)?.joinedRooms.add(room);
        socket.emit('joined_room', { room, tpId, _serverTime: new Date().toISOString() });
      } catch (err) {
        console.error('[join_tp_room]', err);
        socket.emit('error', { message: 'Failed to join TP room' });
      }
    });

    socket.on(
  'care_assistant_location',
  async (payload = {}) => {

    try {

      const {
        bookingId,
        coordinates,
        heading,
      } = payload;

      if (
        !bookingId ||
        !coordinates?.length
      ) return;

      io.to(`booking:${bookingId}`).emit(
        CARE_ASSISTANT_LOCATION_EVENT,
        {
          coordinates,
          heading: heading || 0,
          updatedAt: new Date(),
        }
      );

    } catch (e) {
      console.error(
        '[care_assistant_location]',
        e.message
      );
    }
  }
);

    // ── driver_location ───────────────────────────────────────────────────────
   socket.on(
  'driver_location',

  async ({
    bookingId,
    lat,
    lng,
    heading,
    speed,
    accuracy,
  } = {}) => {

    try {

      const now =
        Date.now();

      const last =
        this.locationThrottle.get(
          socket.id
        ) ?? 0;

      if (
        now - last <
        LOCATION_THROTTLE_MS
      ) {
        return;
      }

      this.locationThrottle.set(
        socket.id,
        now
      );

      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number'
      ) {
        return;
      }

      if (
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return;
      }

      if (
        ![
          'driver',
          'solodriverpartner',
        ].includes(role)
      ) {
        return;
      }

      const coords = [lng, lat];

      await Driver.findOneAndUpdate(
        {
          user: userId,
        },

        {
          'location.type': 'Point',

          'location.coordinates':
            coords,

          'location.heading':
            heading ?? 0,

          'location.speedKmh':
            speed ?? 0,

          'location.updatedAt':
            new Date(),
        }
      );

      if (
        role ===
        'solodriverpartner'
      ) {

        await SoloDriverPartner
          .findOneAndUpdate(
            {
              user: userId,
            },

            {
              'vehicle.lastKnownLocation.type':
                'Point',

              'vehicle.lastKnownLocation.coordinates':
                coords,

              'vehicle.lastLocationUpdatedAt':
                new Date(),
            }
          );
      }

      if (
        bookingId &&
        isValidId(bookingId) &&
        driverObjectId
      ) {

        const ride =
          await Ride.findOne({

            booking: bookingId,

            driver:
              driverObjectId,

            status: {
              $in:
                ACTIVE_RIDE_STATUSES,
            },

          })
            .select(`
              _id
              trackingId
              status
              pickup
              dropoff
              estimatedDistanceKm
            `)
            .lean();

        if (ride) {

          await Ride.findByIdAndUpdate(
            ride._id,

            {
              liveLocation: {

                type: 'Point',

                coordinates:
                  coords,

                heading:
                  heading ?? 0,

                speedKmh:
                  speed ?? 0,

                updatedAt:
                  new Date(),
              },
            }
          );

          let tracking = null;

          if (ride.trackingId) {

            await RideTracking
              .addBreadcrumb(
                ride._id,

                {
                  coordinates:
                    coords,

                  heading:
                    heading ?? 0,

                  speedKmh:
                    speed ?? 0,

                  accuracyM:
                    accuracy ?? null,

                  source: 'gps',
                }
              )
              .catch(e =>
                console.error(
                  '[GPS] breadcrumb:',
                  e.message
                )
              );

            tracking =
              await RideTracking
                .findOne({
                  ride: ride._id,
                });

            if (tracking) {

              const booking =
                await Booking
                  .findById(
                    bookingId
                  )
                  .populate(
                    'careAssistant'
                  )
                  .lean();

              // ─────────────────────────
              // HOSPITAL ETA
              // ─────────────────────────

              if (
                tracking.hospital &&
                tracking.activeTarget ===
                  'hospital_drop'
              ) {

                const hospital =
                  await Hospital
                    .findById(
                      tracking.hospital
                    )
                    .lean();

                if (
                  hospital
                    ?.location
                    ?.coordinates
                    ?.length
                ) {

                  const distanceKm =
                    haversineKm(
                      coords,
                      hospital.location
                        .coordinates
                    );

                  const etaMinutes =
                    calculateEtaMinutes(
                      distanceKm
                    );

                  tracking.liveRouteContext.currentLegDistanceKm =
                    distanceKm;

                  tracking.liveRouteContext.currentLegEtaMinutes =
                    etaMinutes;

                  await tracking.save();

                this.io.to(
  `care:${bookingId}`
)
.emit(
  'hospital:eta:update',
                    {

                      hospitalId:
                        hospital._id,

                      hospitalName:
                        hospital.name,

                      etaMinutes,

                      distanceKm,

                      coordinates:
                        hospital.location
                          .coordinates,
                    }
                  );
                }
              }

              // ─────────────────────────
              // CARE ASSISTANT TRACKING
              // ─────────────────────────

              if (
                booking?.careAssistant
              ) {

                this.io.to(
                  `booking:${bookingId}`
                ).emit(
                  'care-assistant:ride:tracking',
                  {

                    bookingId,

                    rideId:
                      ride._id,

                    driverLocation: {
                      coordinates:
                        coords,
                    },

                    activeTarget:
                      tracking.activeTarget,

                    etaMinutes:
                      tracking
                        ?.liveRouteContext
                        ?.currentLegEtaMinutes || 0,

                    distanceKm:
                      tracking
                        ?.liveRouteContext
                        ?.currentLegDistanceKm || 0,
                  }
                );
              }
            }
          }

          // ─────────────────────────
          // ETA RECALCULATION
          // ─────────────────────────

          const lastEta =
            this.etaThrottle.get(
              socket.id
            ) ?? 0;

          if (
            now - lastEta >
            ETA_RECALC_THROTTLE_MS
          ) {

            this.etaThrottle.set(
              socket.id,
              now
            );

            const mapTarget =
              resolveMapTarget(
                ride.status
              );

            const targetCoords =
              mapTarget ===
              'dropoff'
                ? ride.dropoff
                    ?.coordinates
                : ride.pickup
                    ?.coordinates;

            if (targetCoords) {

              const remainingKm =
                +haversineKm(
                  coords,
                  targetCoords
                ).toFixed(2);

              const speedKmh =
                (
                  speed &&
                  speed > 2
                )
                  ? speed
                  : 30;

              const etaMin =
                Math.round(
                  (
                    remainingKm /
                    speedKmh
                  ) * 60
                );

              if (
                ride.trackingId
              ) {

                RideTracking
                  .addEtaUpdate(
                    ride._id,

                    {
                      toWaypoint:
                        mapTarget,

                      etaMinutes:
                        etaMin,

                      distanceRemainingKm:
                        remainingKm,

                      source:
                        'estimate',
                    }
                  )
                  .catch(e =>
                    console.error(
                      '[GPS] etaUpdate:',
                      e.message
                    )
                  );
              }

              this.io.to(
                `booking:${bookingId}`
              ).emit(
                'eta_update',

                {
                  etaMinutes:
                    etaMin,

                  distanceRemainingKm:
                    remainingKm,

                  currentTarget:
                    mapTarget,

                  _serverTime:
                    new Date()
                      .toISOString(),
                }
              );
            }
          }

          // ─────────────────────────
          // LIVE LOCATION EVENT
          // ─────────────────────────

          this.io.to(
            `booking:${bookingId}`
          ).emit(
            'location_update',

            {
              lat,
              lng,
              heading,
              speed,
              accuracy,

              rideId:
                String(
                  ride._id
                ),

              bookingId,

              role,

              rideStatus:
                ride.status,

              currentTarget:
                resolveMapTarget(
                  ride.status
                ),

              updatedAt:
                new Date()
                  .toISOString(),
            }
          );
        }
      }

      // ─────────────────────────
      // ADMIN TRACKING
      // ─────────────────────────

      this.io.to(
        'admin:ops'
      ).emit(
        'driver_location',

        {
          userId,

          driverObjectId,

          name,

          role,

          lat,
          lng,

          heading:
            heading ?? 0,

          speed:
            speed ?? 0,

          bookingId:
            bookingId || null,

          updatedAt:
            new Date()
              .toISOString(),
        }
      );

    } catch (err) {

      console.error(
        '[driver_location]',
        err.message,
        {
          lat,
          lng,
        }
      );
    }
  }
);

    // ── care_location ─────────────────────────────────────────────────────────
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

    // ── driver_status_update ──────────────────────────────────────────────────
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

        const ride = await Ride.findOne({
          _id:     rideId,
          booking: bookingId,
          driver:  driverObjectId,
        }).select('_id status trackingId pickup dropoff updatedBy');

        if (!ride) {
          socket.emit('error', { message: 'Ride not found or not yours' }); return;
        }

        ride.status    = mappedStatus;
        ride.updatedBy = userId;
        await ride.save();

        try {
          const updatedBooking = await syncBookingStatusFromRide(bookingId, mappedStatus, userId);
          if (updatedBooking) {
            const syncPayload = {
              bookingId, status: updatedBooking.status,
              source: 'ride_status_sync', timestamp: new Date().toISOString(),
            };
            this.io.to(`booking:${bookingId}`).emit('booking_status_change', syncPayload);
            this.io.to('admin:ops').emit('booking_status_change', {
              ...syncPayload, rideStatus: mappedStatus, driverName: name,
            });
          }
        } catch (e) {
          console.error('[driver_status_update] booking sync failed:', e.message);
        }

        const milestoneName = STATUS_MILESTONE_MAP[mappedStatus];
        if (milestoneName && ride.trackingId) {
          RideTracking.addMilestone(ride._id, milestoneName, {
            coordinates: lat && lng ? [lng, lat] : null,
            meta: meta ?? null, recordedBy: 'driver', recordedByUserId: userId,
          }).catch(e => console.error('[status_update] milestone:', e.message));
        }

        if (EXTRA_MILESTONE_MAP[status] && ride.trackingId) {
          RideTracking.addMilestone(ride._id, EXTRA_MILESTONE_MAP[status], {
            coordinates: lat && lng ? [lng, lat] : null,
            meta: meta ?? null, recordedBy: 'driver', recordedByUserId: userId,
          }).catch(e => console.error('[status_update] extra milestone:', e.message));
        }

        const statusPayload = {
          bookingId, rideId, status: mappedStatus, rawStatus: status,
          driverObjectId, driverName: name,
          lat: lat ?? null, lng: lng ?? null,
          currentTarget: resolveMapTarget(mappedStatus),
          updatedAt: new Date().toISOString(),
        };

        this.io.to(`booking:${bookingId}`).emit('ride_status_changed', statusPayload);
        this.io.to('admin:ops').emit('ride_status_changed', statusPayload);
        if (ride.trackingId) {

  const tracking =
    await RideTracking.findById(
      ride.trackingId
    );

  if (tracking) {

    if (
      tracking.activeTarget ===
      'pickup_care_assistant'
    ) {

      tracking.liveRouteContext
        .careAssistantPickupReachedAt =
        new Date();

      tracking.activeTarget =
        'hospital_drop';
    }

    else if (
      tracking.activeTarget ===
      'pickup_patient'
    ) {

      tracking.liveRouteContext
        .patientPickupReachedAt =
        new Date();

      tracking.activeTarget =
        'hospital_drop';
    }

    await tracking.save();
  }
}
        if (mappedStatus === 'driver_arrived') {
          this.emitToAdminOps('otp_for_admin', {
            bookingId, rideId, driverName: name,
            note:      'Driver arrived — OTP dispatched to customer via SMS/email/push',
            timestamp: new Date().toISOString(),
          });
        }

        if (['otp_verified', 'in_progress'].includes(mappedStatus)) {
          const rideDoc = await Ride.findById(rideId).select('dropoff trackingId').lean();
          const trackingDoc = rideDoc?.trackingId
            ? await RideTracking.findById(rideDoc.trackingId).select('expectedRoutePolyline').lean()
            : null;

          this.io.to(`booking:${bookingId}`).emit('navigation_target_changed', {
            bookingId, rideId, currentTarget: 'dropoff',
            coords:   rideDoc?.dropoff?.coordinates,
            address:  rideDoc?.dropoff?.address,
            polyline: trackingDoc?.expectedRoutePolyline || null,
            _serverTime: new Date().toISOString(),
          });
        }

        socket.emit('status_update_ack', {
          rideId, status: mappedStatus, _serverTime: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[driver_status_update]', err);
        socket.emit('error', { message: 'Status update failed' });
      }
    });

    // ── verify_otp ────────────────────────────────────────────────────────────
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
          driver:  driverObjectId,
          status:  'driver_arrived',
        }).select('+pickupOtp trackingId dropoff');

        if (!ride) {
          socket.emit('otp_result', { success: false, message: 'Ride not ready for OTP' }); return;
        }

        const hashedInput = hashOtp(String(otp).trim());
        if (hashedInput !== ride.pickupOtp) {
          socket.emit('otp_result', { success: false, message: 'Invalid OTP' });
          this.io.to(`booking:${bookingId}`).emit('otp_wrong_attempt', {
            bookingId, timestamp: new Date().toISOString(),
          });
          this.emitToAdminOps('otp_failed_attempt', {
            bookingId, rideId, driverObjectId, driverName: name, timestamp: new Date().toISOString(),
          });
          return;
        }

        ride.status              = 'otp_verified';
        ride.pickupOtpVerifiedAt = new Date();
        ride.updatedBy           = userId;
        await ride.save();

        try {
          await syncBookingStatusFromRide(bookingId, 'otp_verified', userId);
        } catch (e) {
          console.error('[verify_otp] syncBookingStatusFromRide failed:', e.message);
          await Booking.findByIdAndUpdate(bookingId, {
            $set: { status: 'in_progress', updatedBy: userId },
          });
        }

        if (ride.trackingId) {
          await Promise.all([
            RideTracking.addMilestone(ride._id, 'otp_verified', { recordedBy: 'driver', recordedByUserId: userId }),
            RideTracking.addMilestone(ride._id, 'ride_started', { recordedBy: 'driver', recordedByUserId: userId }),
          ]).catch(() => {});
          await RideTracking.findByIdAndUpdate(ride.trackingId, { $set: { driver: driverObjectId } });
        }

        const trackingDoc = ride.trackingId
          ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
          : null;

        const successPayload = {
          bookingId, rideId, status: 'otp_verified', verifiedAt: new Date().toISOString(),
        };

        socket.emit('otp_result', { success: true, ...successPayload });

        this.io.to(`booking:${bookingId}`).emit('navigation_target_changed', {
          bookingId, rideId, currentTarget: 'dropoff',
          coords:   ride.dropoff?.coordinates,
          address:  ride.dropoff?.address,
          polyline: trackingDoc?.expectedRoutePolyline || null,
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
      } catch (err) {
        console.error('[verify_otp]', err);
        socket.emit('otp_result', { success: false, message: 'OTP verification failed' });
      }
    });

    // ── sos_trigger ───────────────────────────────────────────────────────────
    socket.on('sos_trigger', async ({ bookingId, rideId, lat, lng, sosType, description } = {}) => {
      try {
        if (!bookingId || !rideId) {
          socket.emit('error', { message: 'bookingId and rideId required' }); return;
        }

        const { allowed } = await canJoinRoom(
          { _id: userId, role, driverObjectId }, `booking:${bookingId}`
        );
        if (!allowed) { socket.emit('error', { message: 'Access denied' }); return; }

        const ride = await Ride.findOne({ _id: rideId, booking: bookingId })
          .select('_id trackingId').lean();
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
            recordedBy:       ['driver', 'solodriverpartner'].includes(role) ? 'driver' : 'customer',
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
      } catch (err) {
        console.error('[sos_trigger]', err);
        socket.emit('error', { message: 'SOS trigger failed' });
      }
    });

    // ── route_deviation ───────────────────────────────────────────────────────
    socket.on('route_deviation', async ({ bookingId, rideId, lat, lng, deviationKm, driverReason } = {}) => {
      try {
        if (!bookingId || !rideId) return;
        const ride = await Ride.findOne({ _id: rideId, booking: bookingId })
          .select('_id trackingId').lean();
        if (!ride) return;

        if (ride.trackingId) {
          await RideTracking.findOneAndUpdate({ ride: ride._id }, {
            $push: {
              routeDeviations: {
                detectedAt:  new Date(), coordinates: lat && lng ? [lng, lat] : null,
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

    // ── otp_resend_request ────────────────────────────────────────────────────
    socket.on('otp_resend_request', async ({ bookingId } = {}) => {
      try {
        if (!bookingId || role !== 'customer') return;
        const { allowed } = await canJoinRoom(
          { _id: userId, role, driverObjectId }, `booking:${bookingId}`
        );
        if (!allowed) return;
        socket.to(`booking:${bookingId}`).emit('otp_resend_requested', {
          bookingId, requestedBy: 'customer', timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[otp_resend_request]', err.message);
      }
    });

    // ── request_booking_state ─────────────────────────────────────────────────
    socket.on('request_booking_state', async ({ bookingId } = {}) => {
      try {
        if (!bookingId || !isValidId(bookingId)) {
          socket.emit('error', { message: 'Invalid bookingId' }); return;
        }
        const { allowed, reason } = await canJoinRoom(
          { _id: userId, role, driverObjectId }, `booking:${bookingId}`
        );
        if (!allowed) { socket.emit('error', { message: reason || 'Access denied' }); return; }

        const [booking, activeRide] = await Promise.all([
          Booking.findById(bookingId)
            .select('status scheduledAt bookingType patientInfo fareBreakdown').lean(),
          Ride.findOne({ booking: bookingId, status: { $in: ACTIVE_RIDE_STATUSES } })
            .select('status liveLocation driverSnapshot vehicleSnapshot trackingId currentEtaMinutes pickup dropoff estimatedDistanceKm estimatedDurationMin')
            .lean(),
        ]);

        if (!booking) { socket.emit('error', { message: 'Booking not found' }); return; }

        let tracking = null;
        if (activeRide?.trackingId) {
          tracking = await RideTracking.findById(activeRide.trackingId)
            .select('currentEtaMinutes totalDistanceKm hasActiveSos milestones expectedRoutePolyline')
            .lean();
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
            expectedRoutePolyline: tracking.expectedRoutePolyline,
          } : null,
          _serverTime: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[request_booking_state]', err);
        socket.emit('error', { message: 'Failed to fetch booking state' });
      }
    });

    // ── leave_booking_room ────────────────────────────────────────────────────
    socket.on('leave_booking_room', ({ bookingId } = {}) => {
      if (!bookingId) return;
      const room = `booking:${bookingId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      socket.emit('left_room', { room, _serverTime: new Date().toISOString() });
    });

    // ── leave_tp_room ─────────────────────────────────────────────────────────
    socket.on('leave_tp_room', ({ tpId } = {}) => {
      if (!tpId) return;
      const room = `tp:${tpId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      socket.emit('left_room', { room, _serverTime: new Date().toISOString() });
    });

    // ── ping_health ───────────────────────────────────────────────────────────
    socket.on('ping_health', () => {
      socket.emit('pong_health', {
        serverTime:     new Date().toISOString(),
        connectedSince: this.connectedClients.get(socket.id)?.connectedAt,
      });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const meta = this.connectedClients.get(socket.id);

      this.locationThrottle.delete(socket.id);
      this.etaThrottle.delete(socket.id);
      this.connectedClients.delete(socket.id);

      if (meta && ['driver', 'solodriverpartner'].includes(meta.role)) {
        this.io.to('admin:ops').emit('driver_offline', {
          userId: meta.userId, driverObjectId: meta.driverObjectId,
          role: meta.role, name: meta.name, timestamp: new Date().toISOString(),
        });
      }

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
// INIT
// ─────────────────────────────────────────────────────────────────────────────

export const initBookingSocket = (io) => {
  if (_instance) {
    console.warn('[BookingSocket] Already initialized — skipping');
    return _instance;
  }

  const service = new BookingSocketService(io);
  _instance     = service;

  // Global auth middleware (default namespace)
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

      let driverObjectId = null;
      if (['driver', 'solodriverpartner'].includes(user.role)) {
        const driver = await Driver.findOne({ user: userId }).select('_id').lean();
        driverObjectId = driver?._id?.toString() ?? null;
      }

      socket.user = {
        _id:            userId.toString(),
        role:           user.role,
        name:           user.name,
        driverObjectId,
      };

      next();
    } catch (err) {
      console.error('[Socket Auth]', err.message);
      next(new Error(`AUTH_ERROR: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    service.setupSocket(socket, socket.user);
  });

  io.on('error', (err) => {
    console.error('[Socket.io server error]', err.message);
  });

  console.log('[BookingSocket] Initialized ✅ (ride/transport only)');
  return service;
};

export const getBookingSocketService = () => _instance;