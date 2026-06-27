import express from 'express';

import Booking              from '../models/Booking.js';
import Ride                 from '../models/Ride.js';
import RideTracking         from '../models/RideTracking.js';
import User                 from '../models/User.js';
import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import TransportPartner     from '../models/TransportPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import Hospital             from '../models/Hospital.js';
import OutPatientRecord     from '../models/OutPatientRecord.js';
import DoctorProfile        from '../models/DoctorProfile.js';
import SystemLog            from '../models/SystemLog.js';

import sendSms                       from '../services/Sendsms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }   from '../services/bookingSocketService.js';
import {
  transactionalTemplate,
  otpTemplate,
  buildDeliveryOtpEmail,
} from '../utils/emailTemplates.js';
import { rideCompletedSms, driverAssignedSms, otpSms } from '../utils/Smstemplates.js';
import { generateOpHtml, buildOpZipBuffer } from '../utils/opDocumentGenerator.js';
import { opConfirmationEmailTemplate }       from '../utils/opEmailTemplates.js';

import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  genOtp,
  hashOtp,
  haversineKm,
  createNotification,
  buildRidePayload,
  createAndLinkRide,
  calculateCanonicalRoute,
  resolveCareRideKmRate,
  syncBookingStatusFromRide,
  RIDE_STATUSES_ACTIVE,
  CARE_RIDE_RADIUS_M,
} from './bookingRouterShared.js';

import { sendOtpEmail } from '../services/emailQueueService.js';
import sendEmail        from '../utils/sendEmail.js';

import cache       from '../middleware/cache.js';
import redisClient from '../config/redis.js';

const router = express.Router();

const CACHE_TTL = { nearby: 30, ops: 45 };

 

 

 

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPERS — fire-and-forget wrappers used throughout this router
// ─────────────────────────────────────────────────────────────────────────────

const resolveDriverIdentity = async (userId, role) => {
  if (role === 'driver') {
    const doc = await Driver.findOne({ user: userId })
      .select('_id legalName driverCode status assignedVehicleSnapshot ownerAgency phone')
      .populate('ownerAgency', 'businessName ownerPhone')
      .lean();
    if (!doc) return null;
    return {
      type:            'agency',
      driverId:        doc._id,          // Ride.driver = Driver._id
      rideField:       'driver',         // field on Ride doc
      doc,
      displayName:     doc.legalName,
      phone:           doc.phone,
      vehicleSnapshot: doc.assignedVehicleSnapshot,
    };
  }
 
  if (role === 'solodriverpartner') {
    const doc = await SoloDriverPartner.findOne({ user: userId })
      .select('_id legalName partnerCode dispatch partnershipStatus isAvailable phone vehicleStatus')
      .lean();
    if (!doc) return null;
 
    // Get vehicle snapshot from Vehicle collection (source of truth for solo)
    const vehicle = await Vehicle.findOne({ ownerType: 'SoloDriverPartner', ownerId: doc._id })
      .select('registrationNumber make model color vehicleType vehicleCode')
      .lean();
 
    const vehicleSnapshot = vehicle ? {
      vehicleCode:        vehicle.vehicleCode,
      registrationNumber: vehicle.registrationNumber,
      make:               vehicle.make,
      model:              vehicle.model,
      vehicleType:        vehicle.vehicleType,
      color:              vehicle.color,
    } : null;
 
    return {
      type:            'solo',
      driverId:        doc._id,          // Ride.soloPartner = SoloDriverPartner._id
      rideField:       'soloPartner',    // field on Ride doc
      doc,
      displayName:     doc.legalName,
      phone:           doc.phone,
      vehicleSnapshot,
    };
  }
 
  return null;
};
 
// ─────────────────────────────────────────────────────────────────────────────
// HELPER: find active ride for a booking scoped to this driver/solo partner
// ─────────────────────────────────────────────────────────────────────────────
const findRideForDriver = (bookingId, identity, statusFilter) => {
  const filter = { booking: bookingId, [identity.rideField]: identity.driverId };
  if (statusFilter) filter.status = statusFilter;
  return Ride.findOne(filter);
};
 
const invalidateBookingCache = async () => {
  try {
    const patterns = ['GET:/admin/bookings*', 'GET:/op/*', 'GET:/tp/*', 'GET:/driver/*'];
    for (const pattern of patterns) {
      let cursor = 0;
      do {
        const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        if (reply.keys.length) await redisClient.del(reply.keys);
      } while (cursor !== 0);
    }
  } catch (e) { console.error('[Cache] invalidation error:', e.message); }
};
 
const getBookingCoords = (booking) => ({
  pickupCoords:   booking.patientLocation?.coordinates     || [80.648, 16.506],
  pickupAddress:  booking.patientLocation?.address         || '',
  pickupCity:     booking.patientLocation?.city            || '',
  dropoffCoords:  booking.destinationLocation?.coordinates || [80.648, 16.506],
  dropoffAddress: booking.destinationLocation?.address     || '',
  dropoffCity:    booking.destinationLocation?.city        || '',
});
 
const joinBookingRoom = (userId, bookingId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `booking:${bookingId}`); }
  catch (e) { console.error('[joinBookingRoom]', e.message); }
};
 
const sendOpZipEmail = async ({ op, booking, doctor, hospital, patient, followUps = [] }) => {
  try {
    const html = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zip  = await buildOpZipBuffer(html, op.opNumber);
    await sendEmail({
      email:   patient.email,
      subject: `Your OP Card — ${op.opNumber} | Likeson Healthcare`,
      html:    opConfirmationEmailTemplate({
        patientName:      patient.name,
        doctorName:       doctor?.user?.name || booking?.doctorSnapshot?.name || 'Your Doctor',
        hospitalName:     hospital?.name || null,
        opNumber:         op.opNumber,
        bookingCode:      booking.bookingCode,
        scheduledAt:      op.scheduledAt || booking.scheduledAt,
        consultationType: op.consultationType,
        isFollowUp:       op.isFollowUp,
        followUpExpiry:   op.followUpExpiry,
        followUpFee:      op.followUpFee,
      }),
      attachments: [{
        content:     zip.toString('base64'),
        filename:    `${op.opNumber.replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`,
        type:        'application/zip',
        disposition: 'attachment',
      }],
    });
  } catch (e) { console.error('[OP ZIP Email] failed:', e.message); }
};
 
// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
 
const emailDriverAssigned = (customer, booking, identity, driverUser) => {
  if (!customer?.email) return;
  sendEmail({
    email:   customer.email,
    subject: `Driver Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
    html: transactionalTemplate({
      header: 'DRIVER ASSIGNED',
      title:  `Your driver is on the way, ${customer.name}!`,
      body: `
        <strong>Booking:</strong> #${booking.bookingCode}<br/>
        <strong>Driver:</strong> ${identity.displayName || driverUser.name}<br/>
        <strong>Vehicle:</strong> ${identity.vehicleSnapshot?.registrationNumber || 'N/A'}
          ${identity.vehicleSnapshot?.make || ''} ${identity.vehicleSnapshot?.model || ''}<br/>
        <strong>Driver Phone:</strong> ${identity.phone || driverUser.phone || 'N/A'}
      `,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      buttonText: 'Track Your Ride',
    }),
  }).catch(e => console.error('[emailDriverAssigned]', e.message));
};
 
const emailRideRejected = (customer, booking, reason) => {
  if (!customer?.email) return;
  sendEmail({
    email:   customer.email,
    subject: `Ride Update — Booking #${booking.bookingCode} | Likeson Healthcare`,
    html: transactionalTemplate({
      header: 'RIDE UPDATE',
      title:  'Driver unavailable — finding another driver',
      body: `Your booking <strong>#${booking.bookingCode}</strong> driver was unable to accept ${reason ? `(${reason})` : ''}. We are reassigning.`,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      buttonText: 'View Booking',
    }),
  }).catch(e => console.error('[emailRideRejected]', e.message));
};
 
const emailRideRequested = (customer, booking, data) => {
  if (!customer?.email) return;
  sendEmail({
    email:   customer.email,
    subject: `Ride Requested — Booking #${booking.bookingCode} | Likeson Healthcare`,
    html: transactionalTemplate({
      header: 'RIDE REQUESTED',
      title:  `Ride booked! We're finding your driver`,
      body: `
        <strong>Booking:</strong> #${booking.bookingCode}<br/>
        <strong>Pickup:</strong> ${data.pickup?.address || 'As provided'}<br/>
        <strong>Drop:</strong> ${data.destination?.address || 'As provided'}<br/>
        <strong>Distance:</strong> ${data.distKm} km | <strong>Est. Fare:</strong> ₹${data.transportFee}
      `,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      buttonText: 'Track Booking',
    }),
  }).catch(e => console.error('[emailRideRequested]', e.message));
};
 
const emailNoDriverNearby = (booking, data) => {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@likeson.in';
  sendEmail({
    email:   supportEmail,
    subject: `⚠️ No Driver Nearby — Booking #${booking.bookingCode} | Action Required`,
    html: transactionalTemplate({
      header: 'OPS ALERT',
      title:  `No driver within ${data.searchRadiusKm}km — manual assignment needed`,
      body: `
        <strong>Booking:</strong> #${booking.bookingCode}<br/>
        <strong>Ride ID:</strong> ${data.rideId}<br/>
        <strong>Pickup:</strong> ${data.pickup?.address || JSON.stringify(data.pickup?.coordinates)}<br/>
        <strong>Drop:</strong> ${data.destination?.address || JSON.stringify(data.destination?.coordinates)}<br/>
        <strong>Distance:</strong> ${data.distKm} km | ₹${data.transportFee}
      `,
      buttonLink: `${process.env.FRONTEND_URL}/admin/bookings/${booking._id}`,
      buttonText: 'Assign Driver Now',
    }),
  }).catch(e => console.error('[emailNoDriverNearby]', e.message));
};
 
const emailDoctorRideCompleted = async (booking) => {
  try {
    if (!booking.doctor) return;
    const doctorProfile = await DoctorProfile.findById(booking.doctor)
      .populate('user', 'name email').lean();
    if (!doctorProfile?.user?.email) return;
    sendEmail({
      email:   doctorProfile.user.email,
      subject: `Patient Ride Completed — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header: 'PATIENT UPDATE',
        title:  'Patient ride completed',
        body:   `Booking <strong>#${booking.bookingCode}</strong> completed. Patient: <strong>${booking.patientInfo?.name || 'N/A'}</strong>`,
        buttonLink: `${process.env.FRONTEND_URL}/doctor/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    }).catch(() => {});
  } catch (e) { console.error('[emailDoctorRideCompleted]', e.message); }
};
 
const emailHospitalRideCompleted = async (booking) => {
  try {
    if (!booking.hospital) return;
    const hospital = await Hospital.findById(booking.hospital).select('name contactEmail').lean();
    if (!hospital?.contactEmail) return;
    sendEmail({
      email:   hospital.contactEmail,
      subject: `Patient Booking Completed — #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header: 'HOSPITAL NOTIFICATION',
        title:  'Patient booking completed',
        body:   `Booking <strong>#${booking.bookingCode}</strong> complete. Patient: <strong>${booking.patientInfo?.name || 'N/A'}</strong>`,
        buttonLink: `${process.env.FRONTEND_URL}/hospital/bookings/${booking._id}`,
        buttonText: 'View Records',
      }),
    }).catch(() => {});
  } catch (e) { console.error('[emailHospitalRideCompleted]', e.message); }
};

// ═════════════════════════════════════════════════════════════════════════════
// DRIVER ROUTES
// CRITICAL: Ride.driver = Driver._id (NOT User._id)
//
// BUSINESS RULE: A normal/agency Driver only ever gets linked to a Ride
// through its own TransportPartner (see /:id/tp/assign-driver and
// /:id/tp/reassign-driver in the consultations/admin router file).
// Admin/superadmin never assigns an agency Driver directly — admin's only
// direct-driver path is a SoloDriverPartner (POST /admin/bookings/:id/assign/solo-driver,
// in the same file). There is intentionally no admin "reassign driver" route
// here — that capability belongs to the TP for its own fleet.
// ═════════════════════════════════════════════════════════════════════════════

router.get('/driver/assigned',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const identity = await resolveDriverIdentity(req.user._id, req.user.role);
      if (!identity) {
        return res.status(404).json({
          success: false,
          message: req.user.role === 'driver'
            ? 'Driver profile not found. Contact admin.'
            : 'SoloDriverPartner profile not found. Contact admin.',
        });
      }
 
      // Ride filter differs: agency → Ride.driver, solo → Ride.soloPartner
      const rides = await Ride.find({
        [identity.rideField]: identity.driverId,
        status: { $in: RIDE_STATUSES_ACTIVE },
      })
        .populate({
          path:   'booking',
          select: 'bookingCode bookingType scheduledAt patientInfo fareBreakdown status patientLocation destinationLocation consultationType notificationsSent doctor hospital',
          populate: [
            { path: 'customer', select: 'name phone avatar' },
            { path: 'doctor', select: 'specialization registrationNumber', populate: { path: 'user', select: 'name phone' } },
            { path: 'hospital', select: 'name address contact' },
          ],
        })
        .populate('trackingId', 'expectedRoutePolyline currentEtaMinutes hasActiveSos')
        .select('rideCode rideType vehicleClass status pickup dropoff liveLocation scheduledPickupAt estimatedDistanceKm estimatedDurationMin driverAssignedAt driverAcceptedAt rideStartedAt fare trackingId booking transportPartner soloPartner vehicleSnapshot driverSnapshot isReturnRide')
        .sort({ scheduledPickupAt: 1, createdAt: -1 })
        .lean();
 
      // Build response shape
      const driverInfo = identity.type === 'agency'
        ? {
            type:                    'agency',
            driverCode:              identity.doc.driverCode,
            legalName:               identity.doc.legalName,
            phone:                   identity.doc.phone,
            status:                  identity.doc.status,
            assignedVehicleSnapshot: identity.vehicleSnapshot,
            ownerAgency:             identity.doc.ownerAgency || null,
          }
        : {
            type:                    'solo',
            partnerCode:             identity.doc.partnerCode,
            legalName:               identity.doc.legalName,
            phone:                   identity.doc.phone,
            dispatchStatus:          identity.doc.dispatch?.status,
            currentRide:             identity.doc.dispatch?.currentRide,
            partnershipStatus:       identity.doc.partnershipStatus,
            isAvailable:             identity.doc.isAvailable,
            vehicleSnapshot:         identity.vehicleSnapshot,  // from Vehicle collection
          };
 
      return res.json({
        success: true,
        data: { driver: driverInfo, rides, total: rides.length },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/ride/accept',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const identity = await resolveDriverIdentity(req.user._id, req.user.role);
      if (!identity) return res.status(404).json({ success: false, message: 'Driver profile not found' });
 
      const ride = await findRideForDriver(req.params.id, identity, 'driver_assigned');
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (ride.status !== 'driver_assigned')
        return res.status(400).json({ success: false, message: `Ride status is ${ride.status}, expected driver_assigned` });
 
      ride.status           = 'driver_accepted';
      ride.driverAcceptedAt = new Date();
      ride.activeTarget     = 'patient_pickup';
      ride.currentLeg       = 'driver_to_patient';
      await ride.save();
 
      // Solo partner: update dispatch state (no Driver doc to update)
      if (identity.type === 'solo') {
        await SoloDriverPartner.findByIdAndUpdate(identity.driverId, {
          'dispatch.status':      'On-Trip',
          'dispatch.currentRide': ride._id,
          'dispatch.lastStatusAt': new Date(),
        });
      }
 
      const booking    = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
 
      await syncBookingStatusFromRide(booking._id, 'driver_accepted', req.user._id);
 
      const customer   = await User.findById(booking.customer).select('email phone name').lean();
      const driverUser = await User.findById(req.user._id).select('name phone').lean();
 
      await createNotification({
        recipient: booking.customer,
        title:     'Driver Accepted',
        body:      `Driver ${identity.displayName || driverUser.name} accepted your ride.`,
        type:      'Driver_Assigned',
        bookingId: booking._id,
      });
 
      sendSms({
        to:      customer.phone,
        message: driverAssignedSms({
          userName:      customer.name,
          rideId:        booking.bookingCode,
          driverName:    identity.displayName || driverUser.name,
          vehicleNumber: identity.vehicleSnapshot?.registrationNumber || 'N/A',
          driverPhone:   identity.phone || driverUser.phone,
        }),
      }).catch(e => console.error('[Accept] SMS:', e.message));
 
      emailDriverAssigned(customer, booking, identity, driverUser);
 
      const trackingDoc = ride.trackingId
        ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
        : null;
 
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
        bookingId:  booking._id,
        status:     'confirmed',
        timestamp:  new Date(),
        driverInfo: {
          name:          identity.displayName || driverUser.name,
          phone:         identity.phone       || driverUser.phone,
          vehicleNumber: identity.vehicleSnapshot?.registrationNumber || 'N/A',
          vehicleMake:   identity.vehicleSnapshot?.make,
          vehicleModel:  identity.vehicleSnapshot?.model,
          vehicleColor:  identity.vehicleSnapshot?.color,
          driverType:    identity.type,
        },
        mapRoute: {
          polyline:         trackingDoc?.expectedRoutePolyline || null,
          pickupCoords:     ride.pickup?.coordinates,
          pickupAddress:    ride.pickup?.address,
          dropoffCoords:    ride.dropoff?.coordinates,
          dropoffAddress:   ride.dropoff?.address,
          estimatedDistKm:  ride.estimatedDistanceKm,
          estimatedMinutes: ride.estimatedDurationMin,
          currentTarget:    'pickup',
        },
      });
 
      await invalidateBookingCache();
      return res.json({
        success: true,
        message: 'Ride accepted',
        data: {
          ride,
          driverInfo:   { name: identity.displayName, phone: identity.phone, vehicleNumber: identity.vehicleSnapshot?.registrationNumber || 'N/A' },
          customerInfo: { name: customer.name, phone: customer.phone },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// PATCH /:id/ride/reject
//
// SOLO: reset dispatch.status → 'Available', clear currentRide
// AGENCY: no Driver status update needed (TP handles that separately)
// ═════════════════════════════════════════════════════════════════════════════
 
router.patch('/:id/ride/reject',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { reason } = req.body;
      const identity   = await resolveDriverIdentity(req.user._id, req.user.role);
      if (!identity) return res.status(404).json({ success: false, message: 'Driver profile not found' });
 
      const ride = await findRideForDriver(req.params.id, identity);
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
 
      ride.status       = 'cancelled';
      ride.cancellation = {
        cancelledBy:       identity.type === 'agency' ? 'driver' : 'driver',
        cancelledByUserId: req.user._id,
        reason:            reason || 'Driver rejected',
        cancelledAt:       new Date(),
      };
      await ride.save();
 
      // Track declined driver: only meaningful for agency drivers
      if (identity.type === 'agency') {
        await Ride.findByIdAndUpdate(ride._id, { $addToSet: { declinedDrivers: identity.driverId } });
      }
 
      // Solo: reset dispatch state
      if (identity.type === 'solo') {
        await SoloDriverPartner.findByIdAndUpdate(identity.driverId, {
          'dispatch.status':      'Available',
          'dispatch.currentRide': null,
          'dispatch.lastStatusAt': new Date(),
        });
      }
 
      const booking  = await Booking.findById(req.params.id).select('bookingCode transportPartner customer').lean();
      const customer = await User.findById(booking?.customer).select('email phone name').lean();
 
      if (booking) emailRideRejected(customer, booking, reason);
 
      if (booking?.transportPartner) {
        getBookingSocketService()?.emitToRoom(`tp:${booking.transportPartner}`, 'driver_rejected', {
          bookingId:   req.params.id,
          bookingCode: booking.bookingCode,
          reason:      reason || 'Driver rejected',
        });
      }
      getBookingSocketService()?.emitToRoom('admin:ops', 'driver_rejected', {
        bookingId:   req.params.id,
        driverType:  identity.type,
        driverId:    identity.driverId,
      });
 
      return res.json({ success: true, message: 'Ride rejected. Will be reassigned.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// PATCH /:id/ride/arrived
// Both agency + solo: same logic, just find ride by correct field
// ═════════════════════════════════════════════════════════════════════════════
 
router.patch('/:id/ride/arrived',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const identity = await resolveDriverIdentity(req.user._id, req.user.role);
      if (!identity) return res.status(404).json({ success: false, message: 'Driver profile not found' });
 
      const ride = await findRideForDriver(req.params.id, identity);
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['driver_accepted', 'driver_en_route'].includes(ride.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot mark arrived from status: ${ride.status}`,
        });
      }
 
      const otp      = genOtp();
      ride.status    = 'driver_arrived';
      ride.pickupOtp = hashOtp(otp);
      await ride.save();
 
      if (ride.trackingId) {
        RideTracking.addMilestone(ride._id, 'driver_arrived', {
          recordedBy: 'driver', recordedByUserId: req.user._id,
        }).catch(e => console.error('[Arrived] milestone:', e.message));
      }
 
      const booking  = await Booking.findById(req.params.id);
      const customer = await User.findById(booking.customer).select('email phone name').lean();
 
      sendSms({
        to:      customer.phone,
        message: otpSms({ otpCode: otp, purpose: `ride start #${booking.bookingCode}` }),
      }).catch(e => console.error('[Arrived] OTP SMS:', e.message));
 
      if (customer?.email) {
        sendEmail({
          email:   customer.email,
          subject: `Your Driver Has Arrived — OTP ${otp} | Booking #${booking.bookingCode}`,
          html:    buildDeliveryOtpEmail({
            userName: customer.name,
            order:    { orderId: booking.bookingCode },
            otpCode:  otp,
          }),
        }).catch(e => console.error('[Arrived] OTP email:', e.message));
      }
 
      await createNotification({
        recipient: booking.customer,
        title:     'Driver Arrived',
        body:      `Your driver arrived. Share OTP ${otp} to start your ride.`,
        type:      'Driver_Arrived',
        bookingId: booking._id,
        priority:  'High',
        otp,
      });
 
      const ss = getBookingSocketService();
      ss?.emitToRoom(`booking:${booking._id}`, 'driver_arrived', {
        bookingId: booking._id, currentTarget: 'pickup', otp,
      });
      ss?.emitToRoom(`booking:${booking._id}`, 'otp_required', { bookingId: booking._id, otp });
      ss?.emitOtpToAdmin({
        bookingId:     booking._id,
        bookingCode:   booking.bookingCode,
        rideId:        ride._id,
        otp,
        customerName:  customer.name,
        customerPhone: customer.phone,
      });
 
      return res.json({ success: true, message: 'Arrival marked. OTP sent to customer.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post('/:id/ride/end',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { dropPhotoUrl, actualDistanceKm } = req.body;
 
      const identity = await resolveDriverIdentity(req.user._id, req.user.role);
      if (!identity) return res.status(404).json({ success: false, message: 'Driver profile not found' });
 
      const ride = await findRideForDriver(req.params.id, identity);
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['in_progress', 'at_stop'].includes(ride.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot end ride from status: ${ride.status}`,
        });
      }
 
      ride.status           = 'completed';
      ride.actualDistanceKm = actualDistanceKm || ride.estimatedDistanceKm || 0;
      if (dropPhotoUrl) ride.internalNotes = `dropPhoto:${dropPhotoUrl}`;
      await ride.save();
 
      RideTracking.computeSummary(ride._id).catch(() => {});
      if (ride.trackingId) {
        RideTracking.addMilestone(ride._id, 'ride_completed', {
          recordedBy: 'driver', recordedByUserId: req.user._id,
        }).catch(() => {});
      }
 
      // Solo: reset dispatch state
      if (identity.type === 'solo') {
        await SoloDriverPartner.findByIdAndUpdate(identity.driverId, {
          'dispatch.status':      'Available',
          'dispatch.currentRide': null,
          'dispatch.lastStatusAt': new Date(),
          isAvailable:            true,
        });
      }
 
      const booking = await Booking.findById(req.params.id).populate('returnRide').lean();
 
      // ── Return ride activation ────────────────────────────────────────────
      if (booking.returnRide && !['completed', 'cancelled'].includes(booking.returnRide?.status)) {
        const returnRide = await Ride.findById(booking.returnRide._id);
        if (returnRide && returnRide.status === 'requested') {
          // Assign same driver (agency or solo)
          returnRide[identity.rideField] = identity.driverId;
          returnRide.status = 'driver_assigned';
 
          const { distanceKm: retKm, durationMin: retMin, polyline: retPolyline } =
            await calculateCanonicalRoute(
              returnRide.pickup?.coordinates,
              returnRide.dropoff?.coordinates,
            );
 
          returnRide.estimatedDistanceKm  = retKm;
          returnRide.estimatedDurationMin = retMin;
          await returnRide.save();
 
          const retTracking = await RideTracking.create({
            ride:                  returnRide._id,
            booking:               booking._id,
            [identity.rideField]:  identity.driverId,
            expectedRoutePolyline: retPolyline,
          });
          await Ride.findByIdAndUpdate(returnRide._id, { $set: { trackingId: retTracking._id } });
 
          const retCustomer = await User.findById(booking.customer).select('email name phone').lean();
          if (retCustomer?.email) {
            sendEmail({
              email:   retCustomer.email,
              subject: `Return Ride Activated — Booking #${booking.bookingCode} | Likeson Healthcare`,
              html: transactionalTemplate({
                header: 'RETURN RIDE ACTIVATED',
                title:  'Your return ride is now active!',
                body: `
                  Outbound ride for booking <strong>#${booking.bookingCode}</strong> is complete.<br/>
                  Same driver will take you back.<br/>
                  <strong>From:</strong> ${returnRide.pickup?.address || 'As scheduled'}<br/>
                  <strong>To:</strong> ${returnRide.dropoff?.address || 'As scheduled'}<br/>
                  <strong>Est. Distance:</strong> ${retKm} km
                `,
                buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
                buttonText: 'Track Return Ride',
              }),
            }).catch(e => console.error('[ReturnRide] email:', e.message));
          }
 
          getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'return_ride_activated', {
            bookingId:        booking._id,
            returnRideId:     returnRide._id,
            currentTarget:    'return_dropoff',
            polyline:         retPolyline,
            estimatedDistKm:  retKm,
            estimatedMinutes: retMin,
          });
 
          await Booking.findByIdAndUpdate(booking._id, {
            $set: { primaryRide: returnRide._id, updatedBy: req.user._id },
          });
 
          return res.json({
            success: true,
            message: 'Outbound ride completed. Return ride activated.',
            data: { completedRideId: ride._id, returnRideId: returnRide._id },
          });
        }
      }
 
      // ── No return ride — complete booking ─────────────────────────────────
      const bookingDoc = await Booking.findById(req.params.id);
      await syncBookingStatusFromRide(bookingDoc._id, 'completed', req.user._id);
 
      const customer = await User.findById(bookingDoc.customer).select('email phone name').lean();
 
      const opForLink = await OutPatientRecord.findOne({ booking: bookingDoc._id })
        .select('opNumber').lean();
 
      await createNotification({
        recipient: bookingDoc.customer,
        title:     'Ride Completed',
        body:      `Booking #${bookingDoc.bookingCode} completed.`,
        type:      'Booking_Completed',
        bookingId: bookingDoc._id,
      });
 
      sendSms({
        to:      customer.phone,
        message: rideCompletedSms({
          userName:  customer.name,
          rideId:    bookingDoc.bookingCode,
          totalFare: bookingDoc.fareBreakdown?.totalAmount,
        }),
      }).catch(e => console.error('[End] SMS:', e.message));
 
      // Email customer invoice
      try {
        const pdfBuffer = await generateBookingInvoicePdf(bookingDoc);
        await sendEmail({
          email:   customer.email,
          subject: `Invoice — #${bookingDoc.bookingCode} | Likeson Healthcare`,
          html: transactionalTemplate({
            header: 'BOOKING COMPLETED',
            title:  `Booking #${bookingDoc.bookingCode} complete!`,
            body:   `Total: ₹${bookingDoc.fareBreakdown?.totalAmount}. Invoice attached.`,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${bookingDoc._id}/rate`,
            buttonText: 'Rate Your Experience',
          }),
          attachments: [{
            content:     pdfBuffer.toString('base64'),
            filename:    `invoice-${bookingDoc.bookingCode}.pdf`,
            type:        'application/pdf',
            disposition: 'attachment',
          }],
        });
      } catch (e) { console.error('[End] Invoice email:', e.message); }
 
      await emailDoctorRideCompleted(bookingDoc);
      await emailHospitalRideCompleted(bookingDoc);
 
      // OP zip for consultation bookings
      if (['doctor_consultation', 'full_care_ride', 'follow_up', 'physiotherapist'].includes(bookingDoc.bookingType)) {
        const op        = await OutPatientRecord.findOne({ booking: bookingDoc._id }).lean();
        const doctor    = await DoctorProfile.findById(bookingDoc.doctor).populate('user', 'name').lean();
        const hospital  = await Hospital.findById(bookingDoc.hospital).lean();
        const followUps = op
          ? await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean()
          : [];
        if (op) sendOpZipEmail({ op, booking: bookingDoc, doctor, hospital, patient: customer, followUps });
      }
 
      const ss = getBookingSocketService();
      ss?.emitToRoom(`booking:${bookingDoc._id}`, 'ride_completed', {
        bookingId: bookingDoc._id, completedAt: new Date(),
      });
      ss?.emitToRoom(`booking:${bookingDoc._id}`, 'booking_status_change', {
        bookingId: bookingDoc._id, status: 'completed', timestamp: new Date(),
      });
 
      await invalidateBookingCache();
      return res.json({ success: true, message: 'Ride completed', data: { booking: bookingDoc } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// PATCH /driver/location — HTTP GPS fallback
//
// AGENCY: update Driver.location
// SOLO:   update SoloDriverPartner + Vehicle.location (Vehicle is GPS source for solo)
//         Also updates Vehicle collection (dispatch geo queries run on Vehicle for solo)
// ═════════════════════════════════════════════════════════════════════════════
 
router.patch('/driver/location',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { lat, lng, heading, speed, bookingId } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });
 
      const identity = await resolveDriverIdentity(req.user._id, req.user.role);
      if (!identity) return res.status(404).json({ success: false, message: 'Driver profile not found' });
 
      if (identity.type === 'agency') {
        // Update Driver document location
        await Driver.findByIdAndUpdate(identity.driverId, {
          'location.coordinates': [lng, lat],
          'location.heading':     heading || 0,
          'location.speedKmh':    speed   || 0,
          'location.updatedAt':   new Date(),
        });
      } else {
        // Solo: update Vehicle.location (primary geo source for solo dispatch)
        // Also update User.location for general presence
        const [vehicle] = await Promise.all([
          Vehicle.findOneAndUpdate(
            { ownerType: 'SoloDriverPartner', ownerId: identity.driverId },
            {
              'location.coordinates': [lng, lat],
              heading:                heading || 0,
              speedKmh:               speed   || 0,
              locationUpdatedAt:      new Date(),
            },
            { new: true }
          ).select('_id').lean(),
          User.findByIdAndUpdate(req.user._id, {
            'location.coordinates': [lng, lat],
          }),
        ]);
      }
 
      if (bookingId) {
        const ride = await Ride.findOne({
          booking:               bookingId,
          [identity.rideField]:  identity.driverId,
          status:                { $in: RIDE_STATUSES_ACTIVE },
        }).select('_id trackingId dropoff pickup estimatedDistanceKm status');
 
        if (ride) {
          ride.liveLocation = {
            type: 'Point', coordinates: [lng, lat],
            heading: heading || 0, speedKmh: speed || 0, updatedAt: new Date(),
          };
          await ride.save();
 
          if (ride.trackingId) {
            RideTracking.addBreadcrumb(ride._id, {
              coordinates: [lng, lat], heading: heading || 0,
              speedKmh: speed || 0, source: 'gps',
            }).catch(e => console.error('[Location HTTP] breadcrumb:', e.message));
          }
 
          const isAfterOtp   = ['otp_verified', 'in_progress', 'at_stop'].includes(ride.status);
          const targetCoords = isAfterOtp ? ride.dropoff?.coordinates : ride.pickup?.coordinates;
          let remainingKm    = null;
          let etaMin         = null;
 
          if (targetCoords) {
            remainingKm = +haversineKm([lng, lat], targetCoords).toFixed(2);
            const speedKmh = (speed && speed > 2) ? speed : 30;
            etaMin = Math.round((remainingKm / speedKmh) * 60);
          }
 
          getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'location_update', {
            lat, lng, heading, speed,
            rideId:        String(ride._id),
            bookingId,
            role:          identity.type === 'solo' ? 'solo_driver' : 'driver',
            updatedAt:     new Date(),
            remainingKm,
            etaMinutes:    etaMin,
            currentTarget: isAfterOtp ? 'dropoff' : 'pickup',
            rideStatus:    ride.status,
          });
        }
      }
 
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// POST /:id/request-ride   (customer self-request)
// POST /:id/care/request-ride  (care assistant)
// POST /admin/care-ride/request  (admin)
//
// These don't change per driver type — they create rides in 'searching' status.
// Admin then assigns via /assign/solo-driver or /assign/transport-partner.
// Keeping original logic — no driver type split needed here.
// ═════════════════════════════════════════════════════════════════════════════
 
router.post('/:id/request-ride',
  protect, authorize('customer'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });
 
      const booking = await Booking.findOne({
        _id:      req.params.id,
        customer: req.user._id,
        status:   { $in: ['pending', 'confirmed'] },
      });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not yours' });
 
      const activeRide = await Ride.findOne({
        booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE },
      });
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists for this booking' });
 
      const [pLng, pLat] = pickupLocation.coordinates;
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(req.user._id);
 
      const { distanceKm: canonicalKm, durationMin, polyline } = await calculateCanonicalRoute(
        pickupLocation.coordinates, destinationLocation.coordinates,
      );
      const transportFee  = +(canonicalKm * ratePerKm).toFixed(2);
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;
 
      // Count nearby: check both agency drivers AND active solo vehicles
      const [nearbyAgency, nearbyVehicles] = await Promise.all([
        Driver.countDocuments({
          isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[pLng, pLat], careRadiusRad] } },
        }),
        Vehicle.countDocuments({
          ownerType:          'SoloDriverPartner',
          status:             'active',
          verificationStatus: 'verified',
          assignedDriver:     { $ne: null },
          location: { $geoWithin: { $centerSphere: [[pLng, pLat], careRadiusRad] } },
        }),
      ]);
      const nearbyCount = nearbyAgency + nearbyVehicles;
 
      const pickupGeo  = { type: 'Point', coordinates: pickupLocation.coordinates,  label: pickupLocation.label   || '', address: pickupLocation.address   || '', city: pickupLocation.city   || '' };
      const dropoffGeo = { type: 'Point', coordinates: destinationLocation.coordinates, label: destinationLocation.label || '', address: destinationLocation.address || '', city: destinationLocation.city || '' };
 
      const otp  = genOtp();
      const ride = await Ride.create({
        booking: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler',
        pickup: pickupGeo, dropoff: dropoffGeo,
        scheduledPickupAt:    booking.scheduledAt || new Date(),
        status:               'searching',
        pickupOtp:            hashOtp(otp),
        estimatedDistanceKm:  canonicalKm,
        estimatedDurationMin: durationMin,
        createdBy:            req.user._id,
      });
 
      const tracking = await RideTracking.create({
        ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
 
      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set:  {
          primaryRide:                  ride._id,
          patientLocation:              pickupGeo,
          destinationLocation:          dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
          updatedBy:                    req.user._id,
        },
      });
 
      const customer = await User.findById(req.user._id).select('email name phone').lean();
      emailRideRequested(customer, booking, {
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), transportFee, ratePerKm, rateSource,
      });
 
      if (nearbyCount === 0) emailNoDriverNearby(booking, {
        rideId: ride._id, pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), transportFee, searchRadiusKm: 30,
      });
 
      getBookingSocketService()?.emitToAdminOps('ride_requested_by_customer', {
        bookingId:      booking._id,
        bookingCode:    booking.bookingCode,
        rideId:         ride._id,
        customerId:     req.user._id,
        pickup:         pickupGeo,
        destination:    dropoffGeo,
        distKm:         +canonicalKm.toFixed(2),
        ratePerKm, rateSource, transportFee,
        noDriverNearby: nearbyCount === 0,
        searchRadiusKm: 30,
        timestamp:      new Date(),
      });
 
      return res.json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign.'
          : 'Ride requested. Admin assigning driver.',
        data: {
          rideId: ride._id, pickup: pickupGeo, destination: dropoffGeo,
          distKm: +canonicalKm.toFixed(2), durationMin, ratePerKm, rateSource, transportFee, searchRadiusKm: 30,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT: request ride for patient
// FIX: authorize('care_assistant') underscore
// EMAIL: care assistant + customer + ops if no driver
// ═════════════════════════════════════════════════════════════════════════════

router.post('/:id/care/request-ride',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({
        _id:           req.params.id,
        careAssistant: profile._id,
        status:        { $in: ['confirmed', 'in_progress'] },
      });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      const activeRide = await Ride.findOne({
        booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE },
      });
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists' });

      const [pLng, pLat] = pickupLocation.coordinates;
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);

      const { distanceKm: canonicalKm, durationMin, polyline } = await calculateCanonicalRoute(
        pickupLocation.coordinates, destinationLocation.coordinates,
      );
      const transportFee  = +(canonicalKm * ratePerKm).toFixed(2);
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;
      const nearbyCount   = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false, status: 'Available',
        location: { $geoWithin: { $centerSphere: [[pLng, pLat], careRadiusRad] } },
      });

      const pickupGeo  = { type: 'Point', coordinates: pickupLocation.coordinates,  label: pickupLocation.label   || '', address: pickupLocation.address   || '', city: pickupLocation.city   || '' };
      const dropoffGeo = { type: 'Point', coordinates: destinationLocation.coordinates, label: destinationLocation.label || '', address: destinationLocation.address || '', city: destinationLocation.city || '' };

      const otp  = genOtp();
      const ride = await Ride.create({
        booking: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler',
        pickup: pickupGeo, dropoff: dropoffGeo,
        scheduledPickupAt:    booking.scheduledAt || new Date(),
        status:               'searching',
        pickupOtp:            hashOtp(otp),
        estimatedDistanceKm:  canonicalKm,
        estimatedDurationMin: durationMin,
        createdBy:            req.user._id,
      });

      const tracking = await RideTracking.create({
        ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set:  {
          primaryRide:                  ride._id,
          patientLocation:              pickupGeo,
          destinationLocation:          dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
          updatedBy:                    req.user._id,
        },
      });

      const rideData = {
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), transportFee, ratePerKm, rateSource,
      };

      // EMAIL → care assistant
      const caUser = await User.findById(req.user._id).select('email name phone').lean();
      emailCareAssistantRideRequested(caUser, booking, rideData);

      // EMAIL → customer (patient)
      const customer = await User.findById(booking.customer).select('email name phone').lean();
      if (customer?.email) {
        sendEmail({
          email:   customer.email,
          subject: `Ride Requested for You — Booking #${booking.bookingCode} | Likeson Healthcare`,
          html: transactionalTemplate({
            header:     'RIDE REQUESTED',
            title:      'Your care assistant has requested a ride for you',
            body: `
              Your care assistant arranged a ride for booking <strong>#${booking.bookingCode}</strong>.<br/>
              <strong>Pickup:</strong> ${pickupGeo.address || pickupGeo.label || 'As provided'}<br/>
              <strong>Drop:</strong> ${dropoffGeo.address || dropoffGeo.label || 'As provided'}<br/>
              <strong>Distance:</strong> ${rideData.distKm} km<br/>
              <strong>Est. Fare:</strong> ₹${transportFee}
            `,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
            buttonText: 'Track Booking',
          }),
        }).catch(e => console.error('[CareRide] customer email:', e.message));
      }

      // EMAIL → ops if no driver nearby
      if (nearbyCount === 0) {
        emailNoDriverNearby(booking, {
          ...rideData, rideId: ride._id, requesterType: 'care_assistant', searchRadiusKm: 30,
        });
      }

      getBookingSocketService()?.emitToAdminOps('ride_requested_by_care_assistant', {
        bookingId:       booking._id,
        bookingCode:     booking.bookingCode,
        rideId:          ride._id,
        careAssistantId: profile._id,
        careAssistantUser: req.user._id,
        pickup:          pickupGeo,
        destination:     dropoffGeo,
        distKm:          +canonicalKm.toFixed(2),
        ratePerKm, rateSource, transportFee,
        noDriverNearby:  nearbyCount === 0,
        searchRadiusKm:  30,
        timestamp:       new Date(),
      });

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_requested', {
        bookingId:   booking._id,
        requestedBy: 'care_assistant',
        pickup:      pickupGeo,
        destination: dropoffGeo,
        distKm:      +canonicalKm.toFixed(2),
        transportFee,
        timestamp:   new Date(),
      });

      return res.json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign a solo driver or transport partner.'
          : 'Ride requested. Admin assigning driver.',
        data: {
          rideId:         ride._id,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +canonicalKm.toFixed(2),
          durationMin, ratePerKm, rateSource, transportFee, searchRadiusKm: 30,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN: care-ride request (on behalf of customer or care assistant)
// EMAIL: customer + care assistant notified; ops alert if no driver
// NOTE: This route only SEARCHES and SURFACES nearby drivers/TPs for admin's
// visibility. It does NOT let admin link an agency Driver directly to the
// ride — admin must use /assign/solo-driver or /assign/transport-partner
// (which then requires the TP to pick its own driver).
// ═════════════════════════════════════════════════════════════════════════════

router.post('/admin/care-ride/request',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId, customerId, requesterType, careAssistantId, pickupLocation, destinationLocation } = req.body;

      if (!['customer', 'care_assistant'].includes(requesterType))
        return res.status(400).json({ success: false, message: 'requesterType must be customer or care_assistant' });
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const [pLng, pLat] = pickupLocation.coordinates;

      let booking            = bookingId ? await Booking.findById(bookingId) : null;
      let resolvedCustomerId = customerId;

      if (requesterType === 'care_assistant') {
        if (!careAssistantId)
          return res.status(400).json({ success: false, message: 'careAssistantId required for care_assistant requester' });

        const ca = await CareAssistantProfile.findById(careAssistantId)
          .select('user fullName isActive verification').lean();
        if (!ca) return res.status(404).json({ success: false, message: 'Care assistant not found' });
        if (!ca.isActive || !ca.verification?.isVerified)
          return res.status(400).json({ success: false, message: 'Care assistant not active or verified' });
        if (!booking)
          return res.status(400).json({ success: false, message: 'bookingId required when care_assistant requests ride' });
        resolvedCustomerId = booking.customer;
      }

      if (!resolvedCustomerId)
        return res.status(400).json({ success: false, message: 'customerId required' });

      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(resolvedCustomerId);
      const { distanceKm: canonicalKm, durationMin, polyline } = await calculateCanonicalRoute(
        pickupLocation.coordinates, destinationLocation.coordinates,
      );
      const transportFee  = +(canonicalKm * ratePerKm).toFixed(2);
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;

      const [nearbyDrivers, nearbyTPs] = await Promise.all([
        Driver.find({
          isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[pLng, pLat], careRadiusRad] } },
        })
          .select('driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency soloPartner')
          .populate('ownerAgency', 'businessName ownerPhone')
          .populate('soloPartner', 'legalName phone partnershipStatus')
          .limit(10).lean(),
        TransportPartner.find({
          partnershipStatus: 'active', isAvailable: true,
          'serviceZones.city': { $regex: pickupLocation.city || '', $options: 'i' },
        }).select('businessName ownerPhone fleetInfo serviceZones').limit(10).lean(),
      ]);

      const noDriverNearby = nearbyDrivers.length === 0 && nearbyTPs.length === 0;

      const pickupGeo  = { type: 'Point', coordinates: pickupLocation.coordinates,  label: pickupLocation.label   || '', address: pickupLocation.address   || '', city: pickupLocation.city   || '' };
      const dropoffGeo = { type: 'Point', coordinates: destinationLocation.coordinates, label: destinationLocation.label || '', address: destinationLocation.address || '', city: destinationLocation.city || '' };

      const otp  = genOtp();
      const ride = await Ride.create({
        booking: booking?._id || null, rideType: 'patient', vehicleClass: 'four_wheeler',
        pickup: pickupGeo, dropoff: dropoffGeo,
        scheduledPickupAt:    booking?.scheduledAt || new Date(),
        status:               'searching',
        pickupOtp:            hashOtp(otp),
        estimatedDistanceKm:  canonicalKm,
        estimatedDurationMin: durationMin,
        createdBy:            req.user._id,
      });

      const tracking = await RideTracking.create({
        ride: ride._id, booking: booking?._id || null, expectedRoutePolyline: polyline,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      if (booking) {
        await Booking.findByIdAndUpdate(booking._id, {
          $push: { rides: ride._id },
          $set:  {
            primaryRide:                  ride._id,
            patientLocation:              pickupGeo,
            destinationLocation:          dropoffGeo,
            status:                       'confirmed',
            'fareBreakdown.transportFee': transportFee,
            updatedBy:                    req.user._id,
          },
        });

        // EMAIL → customer
        const customer = await User.findById(resolvedCustomerId).select('email name phone').lean();
        if (customer?.email) {
          sendEmail({
            email:   customer.email,
            subject: `Ride Arranged for You — Booking #${booking.bookingCode} | Likeson Healthcare`,
            html: transactionalTemplate({
              header:     'RIDE ARRANGED',
              title:      'Admin has arranged a ride for your booking',
              body: `
                A ride has been arranged for booking <strong>#${booking.bookingCode}</strong>.<br/>
                <strong>Pickup:</strong> ${pickupGeo.address || pickupGeo.label || 'As provided'}<br/>
                <strong>Drop:</strong> ${dropoffGeo.address || dropoffGeo.label || 'As provided'}<br/>
                <strong>Distance:</strong> ${+canonicalKm.toFixed(2)} km &nbsp;|&nbsp; ₹${transportFee}<br/>
                A driver will be assigned shortly.
              `,
              buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
              buttonText: 'Track Booking',
            }),
          }).catch(e => console.error('[AdminCareRide] customer email:', e.message));
        }

        // EMAIL → care assistant if applicable
        if (requesterType === 'care_assistant' && careAssistantId) {
          const ca     = await CareAssistantProfile.findById(careAssistantId).select('user').lean();
          const caUser = ca ? await User.findById(ca.user).select('email name').lean() : null;
          if (caUser?.email) {
            sendEmail({
              email:   caUser.email,
              subject: `Care Ride Confirmed — Booking #${booking.bookingCode} | Likeson Healthcare`,
              html: transactionalTemplate({
                header:     'CARE RIDE CONFIRMED',
                title:      'Admin confirmed your care ride request',
                body: `
                  The ride for your patient (booking <strong>#${booking.bookingCode}</strong>) has been confirmed by admin.<br/>
                  <strong>Pickup:</strong> ${pickupGeo.address || pickupGeo.label || 'As provided'}<br/>
                  <strong>Drop:</strong> ${dropoffGeo.address || dropoffGeo.label || 'As provided'}<br/>
                  <strong>Distance:</strong> ${+canonicalKm.toFixed(2)} km
                `,
                buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
                buttonText: 'View Booking',
              }),
            }).catch(e => console.error('[AdminCareRide] CA email:', e.message));
          }

          joinBookingRoom(ca.user, booking._id);
        }
        joinBookingRoom(booking.customer, booking._id);
      }

      // EMAIL → ops if no driver nearby
      if (noDriverNearby && booking) {
        emailNoDriverNearby(booking, {
          rideId: ride._id, requesterType, pickup: pickupGeo, destination: dropoffGeo,
          distKm: +canonicalKm.toFixed(2), transportFee, searchRadiusKm: 30,
        });
      }

      getBookingSocketService()?.emitToAdminOps('care_ride_requested', {
        bookingId: booking?._id, bookingCode: booking?.bookingCode, rideId: ride._id,
        requesterType, careAssistantId: careAssistantId || null,
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), ratePerKm, rateSource, transportFee,
        noDriverNearby, nearbyDriverCount: nearbyDrivers.length, nearbyTPCount: nearbyTPs.length,
        searchRadiusKm: 30, timestamp: new Date(),
      });

      await invalidateBookingCache();

      return res.json({
        success: true,
        message: noDriverNearby
          ? 'Care-ride created. No driver within 30km — assign a solo driver or transport partner manually.'
          : `Care-ride created. ${nearbyDrivers.length} driver(s) and ${nearbyTPs.length} TP(s) found nearby. Use /admin/bookings/:id/assign/solo-driver or /assign/transport-partner to finalize.`,
        data: {
          rideId: ride._id, requesterType, pickup: pickupGeo, destination: dropoffGeo,
          distKm: +canonicalKm.toFixed(2), durationMin, ratePerKm, rateSource, transportFee,
          noDriverNearby, searchRadiusKm: 30,
          nearbyDrivers: nearbyDrivers.map(d => ({
            driverId:   d._id,
            name:       d.legalName,
            phone:      d.phone,
            vehicle:    d.assignedVehicleSnapshot,
            rating:     d.performance?.rating,
            distanceKm: +haversineKm(pickupLocation.coordinates, d.location?.coordinates || [0, 0]).toFixed(1),
            type:       d.soloPartner ? 'solo' : 'agency',
            soloPartner: d.soloPartner || null,
            ownerAgency: d.ownerAgency || null,
          })),
          nearbyTPs: nearbyTPs.map(tp => ({
            tpId: tp._id, businessName: tp.businessName, ownerPhone: tp.ownerPhone,
            totalDrivers: tp.fleetInfo?.totalDrivers || 0,
          })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/care-ride/:bookingId/nearby',
  protect, authorize('admin', 'superadmin'),
  cache(30, req => `GET:/admin/care-ride/${req.params.bookingId}/nearby`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId).select('patientLocation customer').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;

      const [soloDrivers, agencyDrivers, tps] = await Promise.all([
        Driver.find({
          soloPartner: { $ne: null }, isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], careRadiusRad] } },
        })
          .populate('soloPartner', 'legalName phone vehicle partnershipStatus')
          .select('driverCode location performance assignedVehicleSnapshot').limit(15).lean(),

        Driver.find({
          ownerAgency: { $ne: null }, isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], careRadiusRad] } },
        })
          .populate('ownerAgency', 'businessName ownerPhone')
          .select('driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency').limit(15).lean(),

        TransportPartner.find({
          partnershipStatus: 'active', isAvailable: true,
          'serviceZones.city': { $regex: booking.patientLocation?.city || '', $options: 'i' },
        })
          .select('businessName ownerPhone fleetInfo serviceZones').limit(10).lean(),
      ]);

      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);

      return res.json({
        success: true,
        data: {
          searchRadiusKm: 30, ratePerKm, rateSource,
          note: 'soloDrivers are assignable directly by admin via /assign/solo-driver. agencyDrivers belong to a TransportPartner fleet — admin assigns the TP via /assign/transport-partner, and the TP picks the driver.',
          soloDrivers: soloDrivers
            .filter(d => d.soloPartner?.partnershipStatus === 'active')
            .map(d => ({
              driverId:   d._id,
              soloPartnerId: d.soloPartner?._id,
              name:       d.soloPartner?.legalName,
              phone:      d.soloPartner?.phone,
              vehicle:    d.assignedVehicleSnapshot,
              rating:     d.performance?.rating,
              distanceKm: +haversineKm(coords, d.location?.coordinates || [0, 0]).toFixed(1),
            })),
          agencyDrivers: agencyDrivers.map(d => ({
            driverId:   d._id,
            agencyId:   d.ownerAgency?._id || d.ownerAgency,
            agencyName: d.ownerAgency?.businessName,
            name:       d.legalName,
            phone:      d.phone,
            vehicle:    d.assignedVehicleSnapshot,
            rating:     d.performance?.rating,
            distanceKm: +haversineKm(coords, d.location?.coordinates || [0, 0]).toFixed(1),
          })),
          transportPartners: tps.map(tp => ({
            tpId: tp._id, businessName: tp.businessName, ownerPhone: tp.ownerPhone,
            totalDrivers: tp.fleetInfo?.totalDrivers || 0, activeDrivers: tp.fleetInfo?.activeDrivers || 0,
          })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/join-ride',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { currentLat, currentLng } = req.body;

      const profile = await CareAssistantProfile.findOne({ user: req.user._id })
        .select('_id fullName').lean();
      if (!profile)
        return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id })
        .select('_id bookingCode customer primaryRide status bookingType').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      if (!booking.primaryRide)
        return res.status(400).json({ success: false, message: 'No active ride on this booking yet' });

      const ride = await Ride.findById(booking.primaryRide)
        .select('_id status trackingId waypoints').lean();
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const activeMidwayStatuses = [
        'driver_assigned', 'driver_accepted', 'driver_en_route',
        'driver_arrived', 'otp_verified', 'in_progress', 'at_stop',
      ];
      if (!activeMidwayStatuses.includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot join ride in status: ${ride.status}` });

      // Mark CA join waypoint as completed
      const updatedWaypoints = (ride.waypoints || []).map(wp => {
        if (wp.type === 'care_assistant_join' && !wp.isCompleted) {
          return { ...wp, isCompleted: true, completedAt: new Date() };
        }
        return wp;
      });

      // Update ride waypoints
      await Ride.findByIdAndUpdate(booking.primaryRide, {
        $set: { waypoints: updatedWaypoints },
      });

      // Update RideTracking: CA is now in_ride, mark join context
      await RideTracking.findOneAndUpdate(
        { ride: booking.primaryRide },
        {
          $set: {
            careAssistantStatus:   'in_ride',
            careAssistantJoinedAt: new Date(),
            'liveRouteContext.careAssistantJoinedAt': new Date(),
            // activeTarget stays at dropoff — driver continues to dropoff
          },
        }
      );

      // Update CA live location if provided
      if (currentLat && currentLng) {
        await RideTracking.updateCareAssistantLocation(booking.primaryRide, {
          coordinates: [currentLng, currentLat], source: 'gps',
        }).catch(() => {});

        await CareAssistantProfile.findByIdAndUpdate(profile._id, {
          'location.coordinates': [currentLng, currentLat],
          'location.updatedAt':   new Date(),
        });
      }

      // Milestone
      RideTracking.addMilestone(booking.primaryRide, 'care_assistant_joined', {
        coordinates:      currentLat && currentLng ? [currentLng, currentLat] : null,
        meta:             { careAssistantId: profile._id },
        recordedBy:       'driver',   // CA action
        recordedByUserId: req.user._id,
      }).catch(() => {});

      // Join booking socket room
      getBookingSocketService()?.emitJoinRoom(String(req.user._id), `booking:${booking._id}`);

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_joined_ride', {
        bookingId:         booking._id,
        rideId:            booking.primaryRide,
        careAssistantId:   profile._id,
        careAssistantName: profile.fullName,
        joinedAt:          new Date(),
        currentLocation:   (currentLat && currentLng) ? { lat: currentLat, lng: currentLng } : null,
        rideStatus:        ride.status,
        // Tells CA client to switch to driver-only tracking mode
        caViewMode:        'driver_tracking_only',
        // JP waypoint now completed — stays on map but marked
        jpCompleted:       true,
        updatedWaypoints,
      });

      await createNotification({
        recipient: booking.customer,
        title:     'Care Assistant Joined',
        body:      `${profile.fullName} has joined your ride.`,
        type:      'Care_Assistant_Assigned',
        bookingId: booking._id,
      });

      return res.json({
        success: true,
        message: 'Joined ride. CA view switched to driver tracking only.',
        data: {
          rideId:            booking.primaryRide,
          bookingId:         booking._id,
          careAssistantStatus: 'in_ride',
          caViewMode:        'driver_tracking_only',
          jpCompleted:       true,
          socketRoom:        `booking:${booking._id}`,
          socketEvents:      ['location_update'],   // CA now listens to driver location only
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);


/**
 * PATCH /:id/care/reached-jp
 * CA signals they have arrived at the join point.
 * Updates status to 'at_pickup', notifies driver + customer.
 * Body: { lat?, lng? }
 */
router.patch('/:id/care/reached-jp',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { lat, lng } = req.body;

      const profile = await CareAssistantProfile.findOne({ user: req.user._id })
        .select('_id fullName').lean();
      if (!profile)
        return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id })
        .select('_id customer primaryRide bookingType bookingCode').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      if (booking.bookingType !== 'full_care_ride')
        return res.status(400).json({ success: false, message: 'reached-jp only valid for full_care_ride' });

      if (!booking.primaryRide)
        return res.status(400).json({ success: false, message: 'No active ride on this booking' });

      // Update CA status in RideTracking
      await RideTracking.updateCareAssistantStatus(booking.primaryRide, 'at_pickup');

      // Update CA location if provided
      if (lat && lng) {
        await RideTracking.updateCareAssistantLocation(booking.primaryRide, {
          coordinates: [lng, lat], source: 'gps',
        }).catch(() => {});

        await CareAssistantProfile.findByIdAndUpdate(profile._id, {
          'location.coordinates': [lng, lat],
          'location.updatedAt':   new Date(),
        });
      }

      // Milestone
      RideTracking.addMilestone(booking.primaryRide, 'care_assistant_joined', {
        coordinates:      lat && lng ? [lng, lat] : null,
        meta:             { event: 'reached_jp', careAssistantId: profile._id },
        recordedBy:       'driver',
        recordedByUserId: req.user._id,
      }).catch(() => {});

      // Notify all parties: CA is at the join point waiting for driver
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_at_jp', {
        bookingId:           booking._id,
        rideId:              booking.primaryRide,
        careAssistantId:     profile._id,
        careAssistantName:   profile.fullName,
        careAssistantStatus: 'at_pickup',
        location:            (lat && lng) ? { lat, lng } : null,
        timestamp:           new Date(),
      });

      await createNotification({
        recipient: booking.customer,
        title:     'Care Assistant at Join Point',
        body:      `${profile.fullName} has reached the pickup point.`,
        type:      'Care_Assistant_Arriving',
        bookingId: booking._id,
      });

      return res.json({
        success: true,
        message: 'Marked as reached join point. Waiting for driver.',
        data: {
          careAssistantStatus: 'at_pickup',
          rideId:              booking.primaryRide,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;