/**
 * availabilityRouter.js — Likeson.in
 *
 * Covers: availability (days/dates), booking schedule reads,
 * and a few role-specific utility routes.
 *
 * Roles handled:
 *   doctor           → weekly slots, schedule, upcoming bookings
 *   hospital         → linked doctors' schedules, hospital hours
 *   care_assistant   → weekly schedule, status toggle, upcoming tasks
 *   transportpartner → fleet availability, service zone hours
 *   solodriverpartner→ own availability, schedule
 *
 * No controllers. Logic inline.
 */

import express from 'express';
import mongoose from 'mongoose';

import { protect, authorize } from '../middleware/authMiddleware.js';

import User                from '../models/User.js';
import DoctorProfile       from '../models/DoctorProfile.js';
import Hospital            from '../models/Hospital.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import TransportPartner    from '../models/TransportPartner.js';
import SoloDriverPartner   from '../models/SoloDriverPartner.js';
import Booking             from '../models/Booking.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Parse "YYYY-MM-DD" → start-of-day / end-of-day Date objects */
function dayRange(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) throw new Error('Invalid date. Use YYYY-MM-DD');
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end   = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Validate HH:MM 24-hour string */
function isValidTime(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }

/** Upcoming window: now → now + days */
function upcomingRange(days = 7) {
  const start = new Date();
  const end   = new Date(Date.now() + days * 86_400_000);
  return { start, end };
}

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████  DOCTOR ROUTES  ██████████████████
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /availability/doctor/weekly
 * Doctor reads own weekly availability (all 7 days + slots).
 */
router.get(
  '/doctor/weekly',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const profile = await DoctorProfile.findOne({ user: req.user._id })
        .select('weeklyAvailability')
        .lean();

      if (!profile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      return res.json({ success: true, data: profile.weeklyAvailability });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /availability/doctor/weekly
 * Doctor replaces full weekly availability.
 *
 * Body: { weeklyAvailability: [ { day, isAvailable, slots: [{startTime, endTime, maxPatients, consultationType}] } ] }
 */
router.put(
  '/doctor/weekly',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const { weeklyAvailability } = req.body;

      if (!Array.isArray(weeklyAvailability)) {
        return res.status(400).json({ success: false, message: 'weeklyAvailability must be array' });
      }

      // Validate days
      for (const entry of weeklyAvailability) {
        if (!DAYS.includes(entry.day)) {
          return res.status(400).json({ success: false, message: `Invalid day: ${entry.day}` });
        }
        if (entry.isAvailable && Array.isArray(entry.slots)) {
          for (const slot of entry.slots) {
            if (!isValidTime(slot.startTime) || !isValidTime(slot.endTime)) {
              return res.status(400).json({ success: false, message: `Slot times must be HH:MM on ${entry.day}` });
            }
          }
        }
      }

      const profile = await DoctorProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: { weeklyAvailability, updatedBy: req.user._id } },
        { new: true, runValidators: true, select: 'weeklyAvailability' }
      );

      if (!profile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      return res.json({ success: true, message: 'Weekly availability updated', data: profile.weeklyAvailability });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /availability/doctor/day/:day
 * Toggle a single day on/off or update its slots.
 *
 * Body: { isAvailable?, slots? }
 */
router.patch(
  '/doctor/day/:day',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const { day } = req.params;
      if (!DAYS.includes(day)) {
        return res.status(400).json({ success: false, message: `Invalid day: ${day}` });
      }

      const { isAvailable, slots } = req.body;
      const setFields = {};

      if (typeof isAvailable === 'boolean') {
        setFields['weeklyAvailability.$[elem].isAvailable'] = isAvailable;
      }
      if (Array.isArray(slots)) {
        for (const slot of slots) {
          if (!isValidTime(slot.startTime) || !isValidTime(slot.endTime)) {
            return res.status(400).json({ success: false, message: 'Slot times must be HH:MM' });
          }
        }
        setFields['weeklyAvailability.$[elem].slots'] = slots;
      }

      const profile = await DoctorProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: setFields },
        {
          arrayFilters: [{ 'elem.day': day }],
          new: true,
          select: 'weeklyAvailability',
        }
      );

      if (!profile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      return res.json({ success: true, message: `${day} updated`, data: profile.weeklyAvailability });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/doctor/schedule
 * Doctor's upcoming confirmed/pending bookings (next 7 days by default).
 *
 * Query: ?days=14
 */
router.get(
  '/doctor/schedule',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const { start, end } = upcomingRange(days);

      const profile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      const bookings = await Booking.find({
        doctor:      profile._id,
        status:      { $in: ['pending', 'confirmed', 'in_progress'] },
        scheduledAt: { $gte: start, $lte: end },
      })
        .populate('customer',      'name phone avatar')
        .populate('hospital',      'name address.city')
        .populate('careAssistant', 'fullName phone')
        .sort({ scheduledAt: 1 })
        .lean();

      return res.json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/doctor/schedule/date/:date
 * Doctor's bookings for a specific date (YYYY-MM-DD).
 */
router.get(
  '/doctor/schedule/date/:date',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const { start, end } = dayRange(req.params.date);

      const profile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      const bookings = await Booking.find({
        doctor:      profile._id,
        scheduledAt: { $gte: start, $lte: end },
      })
        .populate('customer', 'name phone')
        .sort({ scheduledAt: 1 })
        .lean();

      return res.json({
        success: true,
        date:    req.params.date,
        count:   bookings.length,
        data:    bookings,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /availability/doctor/online-status
 * Toggle doctor online/offline.
 *
 * Body: { isOnline: true|false }
 */
router.patch(
  '/doctor/online-status',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const { isOnline } = req.body;
      if (typeof isOnline !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isOnline must be boolean' });
      }

      await DoctorProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: { isOnline, updatedBy: req.user._id } }
      );

      // Sync User.isOnline too
      await User.findByIdAndUpdate(req.user._id, { isOnline, lastActiveAt: new Date() });

      return res.json({ success: true, message: `Doctor is now ${isOnline ? 'online' : 'offline'}` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████  HOSPITAL ROUTES  ██████████████████
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /availability/hospital/hours
 * Hospital manager reads their hospital's operating hours.
 */
router.get(
  '/hospital/hours',
  protect,
  authorize('hospital'),
  async (req, res) => {
    try {
      const hospital = await Hospital.findOne({ managedBy: req.user._id })
        .select('name operatingHours is24x7')
        .lean();

      if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

      return res.json({ success: true, data: { name: hospital.name, is24x7: hospital.is24x7, operatingHours: hospital.operatingHours } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /availability/hospital/hours
 * Hospital manager updates operating hours.
 *
 * Body: { is24x7?: boolean, operatingHours: [{day, openTime, closeTime, is24Hours, isClosed}] }
 */
router.put(
  '/hospital/hours',
  protect,
  authorize('hospital'),
  async (req, res) => {
    try {
      const { operatingHours, is24x7 } = req.body;

      const setObj = { updatedBy: req.user._id };
      if (typeof is24x7 === 'boolean') setObj.is24x7 = is24x7;
      if (Array.isArray(operatingHours)) {
        for (const h of operatingHours) {
          if (!DAYS.includes(h.day)) {
            return res.status(400).json({ success: false, message: `Invalid day: ${h.day}` });
          }
          if (h.openTime && !isValidTime(h.openTime)) {
            return res.status(400).json({ success: false, message: `openTime must be HH:MM on ${h.day}` });
          }
          if (h.closeTime && !isValidTime(h.closeTime)) {
            return res.status(400).json({ success: false, message: `closeTime must be HH:MM on ${h.day}` });
          }
        }
        setObj.operatingHours = operatingHours;
      }

      const hospital = await Hospital.findOneAndUpdate(
        { managedBy: req.user._id },
        { $set: setObj },
        { new: true, select: 'operatingHours is24x7' }
      );

      if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

      return res.json({ success: true, message: 'Operating hours updated', data: hospital });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/hospital/doctors/schedules
 * Hospital manager sees schedules of all linked doctors for upcoming N days.
 *
 * Query: ?days=7
 */
router.get(
  '/hospital/doctors/schedules',
  protect,
  authorize('hospital'),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const { start, end } = upcomingRange(days);

      const hospital = await Hospital.findOne({ managedBy: req.user._id })
        .select('_id linkedDoctors')
        .lean();

      if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

      if (!hospital.linkedDoctors?.length) {
        return res.json({ success: true, message: 'No linked doctors', data: [] });
      }

      // Get bookings for all linked doctors in window
      const bookings = await Booking.find({
        doctor:      { $in: hospital.linkedDoctors },
        hospital:    hospital._id,
        status:      { $in: ['pending', 'confirmed', 'in_progress'] },
        scheduledAt: { $gte: start, $lte: end },
      })
        .populate('doctor',   'specialization profilePhotoUrl')
        .populate('customer', 'name phone')
        .sort({ scheduledAt: 1 })
        .lean();

      // Group by doctor
      const byDoctor = {};
      for (const b of bookings) {
        const key = b.doctor?._id?.toString() ?? 'unknown';
        if (!byDoctor[key]) byDoctor[key] = { doctor: b.doctor, bookings: [] };
        byDoctor[key].bookings.push(b);
      }

      return res.json({ success: true, data: Object.values(byDoctor) });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/hospital/schedule/date/:date
 * Hospital manager: all bookings for the hospital on a specific date.
 */
router.get(
  '/hospital/schedule/date/:date',
  protect,
  authorize('hospital'),
  async (req, res) => {
    try {
      const { start, end } = dayRange(req.params.date);

      const hospital = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
      if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

      const bookings = await Booking.find({
        hospital:    hospital._id,
        scheduledAt: { $gte: start, $lte: end },
      })
        .populate('doctor',   'specialization')
        .populate('customer', 'name phone')
        .sort({ scheduledAt: 1 })
        .lean();

      return res.json({
        success: true,
        date:    req.params.date,
        count:   bookings.length,
        data:    bookings,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████  CARE ASSISTANT ROUTES  ██████████████████
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /availability/care-assistant/weekly
 * Care assistant reads own weekly schedule.
 */
router.get(
  '/care-assistant/weekly',
  protect,
  authorize('care assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id })
        .select('weeklySchedule workType availability.isOnline status')
        .lean();

      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      return res.json({ success: true, data: profile });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /availability/care-assistant/weekly
 * Care assistant updates their weekly schedule.
 *
 * Body: { weeklySchedule: { monday: { isAvailable, startTime, endTime, maxHoursPerDay }, ... } }
 */
router.put(
  '/care-assistant/weekly',
  protect,
  authorize('care assistant'),
  async (req, res) => {
    try {
      const { weeklySchedule } = req.body;

      if (typeof weeklySchedule !== 'object' || Array.isArray(weeklySchedule)) {
        return res.status(400).json({ success: false, message: 'weeklySchedule must be object keyed by day name (lowercase)' });
      }

      const validDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const setFields = {};

      for (const [dayKey, config] of Object.entries(weeklySchedule)) {
        if (!validDayKeys.includes(dayKey)) {
          return res.status(400).json({ success: false, message: `Invalid day key: ${dayKey}` });
        }
        if (config.startTime && !isValidTime(config.startTime)) {
          return res.status(400).json({ success: false, message: `startTime must be HH:MM on ${dayKey}` });
        }
        if (config.endTime && !isValidTime(config.endTime)) {
          return res.status(400).json({ success: false, message: `endTime must be HH:MM on ${dayKey}` });
        }
        if (config.maxHoursPerDay !== undefined && (config.maxHoursPerDay < 1 || config.maxHoursPerDay > 24)) {
          return res.status(400).json({ success: false, message: `maxHoursPerDay must be 1-24 on ${dayKey}` });
        }
        for (const [field, val] of Object.entries(config)) {
          setFields[`weeklySchedule.${dayKey}.${field}`] = val;
        }
      }

      setFields.updatedBy = req.user._id;

      const profile = await CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: setFields },
        { new: true, select: 'weeklySchedule' }
      );

      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      return res.json({ success: true, message: 'Schedule updated', data: profile.weeklySchedule });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /availability/care-assistant/status
 * Toggle care assistant online/availability status.
 *
 * Body: { isOnline: boolean, status?: 'Available'|'Offline'|'On-Break' }
 */
router.patch(
  '/care-assistant/status',
  protect,
  authorize('care assistant'),
  async (req, res) => {
    try {
      const { isOnline, status } = req.body;

      if (typeof isOnline !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isOnline required as boolean' });
      }

      const VALID_STATUSES = ['Available', 'Offline', 'On-Break'];
      const newStatus = status ?? (isOnline ? 'Available' : 'Offline');

      if (!VALID_STATUSES.includes(newStatus)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      }

      await CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        {
          $set: {
            'availability.isOnline': isOnline,
            status:                  newStatus,
            updatedBy:               req.user._id,
          },
        }
      );

      await User.findByIdAndUpdate(req.user._id, { isOnline, lastActiveAt: new Date() });

      return res.json({ success: true, message: `Status → ${newStatus}` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/care-assistant/tasks
 * Care assistant's upcoming assigned bookings.
 *
 * Query: ?days=7
 */
router.get(
  '/care-assistant/tasks',
  protect,
  authorize('care assistant'),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const { start, end } = upcomingRange(days);

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const bookings = await Booking.find({
        careAssistant: profile._id,
        status:        { $in: ['confirmed', 'in_progress', 'pending'] },
        scheduledAt:   { $gte: start, $lte: end },
      })
        .populate('customer', 'name phone')
        .populate('doctor',   'specialization')
        .sort({ scheduledAt: 1 })
        .lean();

      return res.json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/care-assistant/tasks/date/:date
 * Care assistant's tasks on a specific date.
 */
router.get(
  '/care-assistant/tasks/date/:date',
  protect,
  authorize('care assistant'),
  async (req, res) => {
    try {
      const { start, end } = dayRange(req.params.date);

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const bookings = await Booking.find({
        careAssistant: profile._id,
        scheduledAt:   { $gte: start, $lte: end },
      })
        .populate('customer', 'name phone')
        .sort({ scheduledAt: 1 })
        .lean();

      return res.json({
        success: true,
        date:    req.params.date,
        count:   bookings.length,
        data:    bookings,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████  TRANSPORT PARTNER ROUTES  ██████████████████
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /availability/transport/hours
 * Transport partner reads their availability hours.
 */
router.get(
  '/transport/hours',
  protect,
  authorize('transportpartner'),
  async (req, res) => {
    try {
      const agency = await TransportPartner.findOne({ user: req.user._id })
        .select('businessName isAvailable availabilityHours serviceZones')
        .lean();

      if (!agency) return res.status(404).json({ success: false, message: 'Transport partner not found' });

      return res.json({ success: true, data: agency });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /availability/transport/hours
 * Transport partner updates their availability window.
 *
 * Body: { isAvailable?, availabilityHours?: { start: "HH:MM", end: "HH:MM" } }
 */
router.patch(
  '/transport/hours',
  protect,
  authorize('transportpartner'),
  async (req, res) => {
    try {
      const { isAvailable, availabilityHours } = req.body;
      const setFields = { updatedBy: req.user._id };

      if (typeof isAvailable === 'boolean') {
        setFields.isAvailable = isAvailable;
      }

      if (availabilityHours) {
        const { start, end } = availabilityHours;
        if (start && !isValidTime(start)) {
          return res.status(400).json({ success: false, message: 'availabilityHours.start must be HH:MM' });
        }
        if (end && !isValidTime(end)) {
          return res.status(400).json({ success: false, message: 'availabilityHours.end must be HH:MM' });
        }
        if (start) setFields['availabilityHours.start'] = start;
        if (end)   setFields['availabilityHours.end']   = end;
      }

      const agency = await TransportPartner.findOneAndUpdate(
        { user: req.user._id },
        { $set: setFields },
        { new: true, select: 'isAvailable availabilityHours' }
      );

      if (!agency) return res.status(404).json({ success: false, message: 'Transport partner not found' });

      return res.json({ success: true, message: 'Availability updated', data: agency });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/transport/fleet/status
 * Transport partner reads active/total vehicle and driver counts.
 */
router.get(
  '/transport/fleet/status',
  protect,
  authorize('transportpartner'),
  async (req, res) => {
    try {
      const agency = await TransportPartner.findOne({ user: req.user._id })
        .select('fleetInfo vehicles drivers businessName')
        .lean();

      if (!agency) return res.status(404).json({ success: false, message: 'Transport partner not found' });

      // Vehicle breakdown by status
      const verifiedVehicles = agency.vehicles.filter(v => v.verificationStatus === 'verified');
      const activeVehicles   = verifiedVehicles.filter(v => v.isActive);

      return res.json({
        success: true,
        data:    {
          businessName:   agency.businessName,
          fleetInfo:      agency.fleetInfo,
          vehicleSummary: {
            total:    agency.vehicles.length,
            verified: verifiedVehicles.length,
            active:   activeVehicles.length,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/transport/rides/schedule
 * Transport partner: upcoming rides for their fleet.
 *
 * Query: ?days=7
 */
router.get(
  '/transport/rides/schedule',
  protect,
  authorize('transportpartner'),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const { start, end } = upcomingRange(days);

      const agency = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!agency) return res.status(404).json({ success: false, message: 'Transport partner not found' });

      const Ride = mongoose.model('Ride');
      const rides = await Ride.find({
        transportPartner:    agency._id,
        status:              { $in: ['requested', 'searching', 'driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived'] },
        scheduledPickupAt:   { $gte: start, $lte: end },
      })
        .populate('driver',  'driverCode legalName phone')
        .populate('booking', 'bookingCode bookingType patientInfo')
        .sort({ scheduledPickupAt: 1 })
        .lean();

      return res.json({ success: true, count: rides.length, data: rides });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/transport/rides/date/:date
 * Transport partner: rides on a specific date.
 */
router.get(
  '/transport/rides/date/:date',
  protect,
  authorize('transportpartner'),
  async (req, res) => {
    try {
      const { start, end } = dayRange(req.params.date);

      const agency = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!agency) return res.status(404).json({ success: false, message: 'Transport partner not found' });

      const Ride = mongoose.model('Ride');
      const rides = await Ride.find({
        transportPartner:  agency._id,
        scheduledPickupAt: { $gte: start, $lte: end },
      })
        .populate('driver',  'driverCode legalName phone')
        .populate('booking', 'bookingCode bookingType')
        .sort({ scheduledPickupAt: 1 })
        .lean();

      return res.json({
        success: true,
        date:    req.params.date,
        count:   rides.length,
        data:    rides,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████  SOLO DRIVER PARTNER ROUTES  ██████████████████
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /availability/solo/hours
 * Solo driver reads own availability hours.
 */
router.get(
  '/solo/hours',
  protect,
  authorize('solodriverpartner'),
  async (req, res) => {
    try {
      const partner = await SoloDriverPartner.findOne({ user: req.user._id })
        .select('isAvailable availabilityHours serviceZones partnershipStatus')
        .lean();

      if (!partner) return res.status(404).json({ success: false, message: 'Solo driver partner not found' });

      return res.json({ success: true, data: partner });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /availability/solo/hours
 * Solo driver updates availability window + toggle isAvailable.
 *
 * Body: { isAvailable?, availabilityHours?: { start, end } }
 */
router.patch(
  '/solo/hours',
  protect,
  authorize('solodriverpartner'),
  async (req, res) => {
    try {
      const { isAvailable, availabilityHours } = req.body;
      const setFields = { updatedBy: req.user._id };

      if (typeof isAvailable === 'boolean') {
        setFields.isAvailable = isAvailable;
      }

      if (availabilityHours) {
        const { start, end } = availabilityHours;
        if (start && !isValidTime(start)) {
          return res.status(400).json({ success: false, message: 'availabilityHours.start must be HH:MM' });
        }
        if (end && !isValidTime(end)) {
          return res.status(400).json({ success: false, message: 'availabilityHours.end must be HH:MM' });
        }
        if (start) setFields['availabilityHours.start'] = start;
        if (end)   setFields['availabilityHours.end']   = end;
      }

      const partner = await SoloDriverPartner.findOneAndUpdate(
        { user: req.user._id },
        { $set: setFields },
        { new: true, select: 'isAvailable availabilityHours' }
      );

      if (!partner) return res.status(404).json({ success: false, message: 'Solo driver partner not found' });

      return res.json({ success: true, message: 'Availability updated', data: partner });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/solo/rides/schedule
 * Solo driver: upcoming assigned rides.
 *
 * Query: ?days=7
 */
router.get(
  '/solo/rides/schedule',
  protect,
  authorize('solodriverpartner'),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const { start, end } = upcomingRange(days);

      const partner = await SoloDriverPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!partner) return res.status(404).json({ success: false, message: 'Solo driver partner not found' });

      const Ride = mongoose.model('Ride');
      const rides = await Ride.find({
        soloPartner:       partner._id,
        status:            { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived', 'otp_verified', 'in_progress'] },
        scheduledPickupAt: { $gte: start, $lte: end },
      })
        .populate('booking', 'bookingCode bookingType patientInfo')
        .sort({ scheduledPickupAt: 1 })
        .lean();

      return res.json({ success: true, count: rides.length, data: rides });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /availability/solo/rides/date/:date
 * Solo driver: rides on specific date.
 */
router.get(
  '/solo/rides/date/:date',
  protect,
  authorize('solodriverpartner'),
  async (req, res) => {
    try {
      const { start, end } = dayRange(req.params.date);

      const partner = await SoloDriverPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!partner) return res.status(404).json({ success: false, message: 'Solo driver partner not found' });

      const Ride = mongoose.model('Ride');
      const rides = await Ride.find({
        soloPartner:       partner._id,
        scheduledPickupAt: { $gte: start, $lte: end },
      })
        .populate('booking', 'bookingCode bookingType')
        .sort({ scheduledPickupAt: 1 })
        .lean();

      return res.json({
        success: true,
        date:    req.params.date,
        count:   rides.length,
        data:    rides,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /availability/solo/service-zones
 * Solo driver updates their service zones.
 *
 * Body: { serviceZones: [{ city, state, pinCodes?, radiusKm?, isActive? }] }
 */
router.patch(
  '/solo/service-zones',
  protect,
  authorize('solodriverpartner'),
  async (req, res) => {
    try {
      const { serviceZones } = req.body;

      if (!Array.isArray(serviceZones) || serviceZones.length === 0) {
        return res.status(400).json({ success: false, message: 'serviceZones must be non-empty array' });
      }

      for (const zone of serviceZones) {
        if (!zone.city || !zone.state) {
          return res.status(400).json({ success: false, message: 'Each zone must have city and state' });
        }
      }

      const partner = await SoloDriverPartner.findOneAndUpdate(
        { user: req.user._id },
        { $set: { serviceZones, updatedBy: req.user._id } },
        { new: true, select: 'serviceZones' }
      );

      if (!partner) return res.status(404).json({ success: false, message: 'Solo driver partner not found' });

      return res.json({ success: true, message: 'Service zones updated', data: partner.serviceZones });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;