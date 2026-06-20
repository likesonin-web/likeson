import express             from 'express';
import mongoose            from 'mongoose';

// ── Models ────────────────────────────────────────────────────────────────────
import TransportPartner    from '../models/TransportPartner.js';
import Driver              from '../models/Driver.js';
import Vehicle             from '../models/Vehicle.js'; // NEW: Imported Vehicle
import User                from '../models/User.js';
import SystemLog           from '../models/SystemLog.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';

// ── Auth Middleware ───────────────────────────────────────────────────────────
import {
  protect,
  authorize,
  getDeviceInfo,
  attachTransportPartnerAgency,
  transportPartnerRoutes,   // [protect, getDeviceInfo, authorize('transportpartner'), attachTP]
} from '../middleware/authMiddleware.js';

// ── Cache ─────────────────────────────────────────────────────────────────────
import cache from '../middleware/cache.js';
import {
  invalidateKey,
  invalidateKeys,
  invalidatePattern,
} from '../utils/cacheInvalidation.js';

// ── Email ─────────────────────────────────────────────────────────────────────
import sendEmail           from '../utils/sendEmail.js';
import bcrypt from 'bcryptjs';
import { transactionalTemplate } from '../utils/emailTemplates.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Invalidate all cache keys related to one TransportPartner */
const invalidateTPCache = async (agencyId) => {
  await invalidateKeys([
    `tp:${agencyId}`,
    `tp:${agencyId}:vehicles`,
    `tp:${agencyId}:drivers`,
    `tp:${agencyId}:stats`,
    `tp:${agencyId}:zones`,
  ]);
  await invalidatePattern('GET:/api/transport*');
  await invalidatePattern(`GET:/api/admin/transport*`);
};

/** Write a SystemLog entry (fire-and-forget) */
const syslog = (payload) => SystemLog.createLog(payload).catch(() => {});

// ─────────────────────────────────────────────────────────────────────────────
// §A  TRANSPORT PARTNER — OWN PROFILE, KYC, SETTINGS, SECURITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/profile
 * Own full profile (cached 60 s, keyed per partner)
 */
router.get(
  '/profile',
  transportPartnerRoutes,
  cache(60, (req) => `tp:${req.transportPartner.agency._id}`),
  async (req, res) => {
    try {
      const agency = await TransportPartner.findById(req.transportPartner.agency._id)
        .populate('user', 'name email phone avatar isOnline lastseen')
        .select('-internalNotes -bankDetails.bankAccounts.accountNumber -panNumber -ownerKyc.aadhaarNumber -ownerKyc.panNumber');

      return res.json({ success: true, data: agency });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/profile
 * Update own business details (non-sensitive fields only)
 */
router.patch(
  '/profile',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const allowedFields = [
        'businessName', 'ownerName', 'ownerPhone', 'ownerEmail',
        'businessType', 'registeredAddress', 'gstNumber', 'msmeUdyamNumber',
        'isAvailable', 'availabilityHours', 'notifications',
      ];

      const update = {};
      allowedFields.forEach((f) => {
        if (req.body[f] !== undefined) update[f] = req.body[f];
      });

      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $set: update, updatedBy: req.user._id },
        { new: true, runValidators: true }
      ).select('-internalNotes -panNumber');

      await invalidateTPCache(agency._id);

      syslog({
        level: 'info', category: 'user',
        message: `TransportPartner profile updated: ${agency.businessName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: agency._id, label: agency.businessName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
        metadata: { updatedFields: Object.keys(update) },
      });

      return res.json({ success: true, message: 'Profile updated', data: agency });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /api/transport/kyc
 * Submit / update owner KYC details
 */
router.put(
  '/kyc',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const kycFields = [
        'fullName', 'dateOfBirth', 'gender', 'profilePhotoUrl', 'address',
        'aadhaarNumber', 'aadhaarFrontUrl', 'aadhaarBackUrl',
        'panNumber', 'panCardUrl',
        'drivingLicenseNumber', 'drivingLicenseUrl', 'drivingLicenseExpiry',
        'emergencyContact', 'yearsOfExperience', 'languagesSpoken', 'bio',
      ];

      const kycUpdate = {};
      kycFields.forEach((f) => {
        if (req.body[f] !== undefined) kycUpdate[`ownerKyc.${f}`] = req.body[f];
      });

      // When submitting docs, advance kycStatus to 'pending'
      const hasNewDocs = req.body.aadhaarFrontUrl || req.body.panCardUrl;
      if (hasNewDocs) {
        kycUpdate['ownerKyc.kycStatus'] = 'pending';
      }

      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $set: { ...kycUpdate, updatedBy: req.user._id } },
        { new: true, runValidators: true }
      );

      await invalidateTPCache(agency._id);

      syslog({
        level: 'info', category: 'kyc',
        message: `KYC updated for TransportPartner: ${agency.businessName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: agency._id, label: agency.businessName },
        request: { method: 'PUT', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'KYC submitted for review', data: agency.ownerKyc });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/kyc/status
 * Get own KYC status summary
 */
router.get(
  '/kyc/status',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agency = await TransportPartner.findById(req.transportPartner.agency._id)
        .select('ownerKyc.kycStatus ownerKyc.kycVerifiedAt ownerKyc.kycRejectionReason ownerKyc.aadhaarVerified ownerKyc.panVerified ownerKyc.aadhaarLast4');

      return res.json({ success: true, data: agency.ownerKyc });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/settings/notifications
 * Update notification preferences
 */
router.patch(
  '/settings/notifications',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { sms, email, push, whatsapp } = req.body;
      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $set: { notifications: { sms, email, push, whatsapp }, updatedBy: req.user._id } },
        { new: true }
      ).select('notifications');

      await invalidateTPCache(agency._id);
      return res.json({ success: true, message: 'Notification preferences updated', data: agency.notifications });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/settings/availability
 * Toggle availability + hours
 */
router.patch(
  '/settings/availability',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { isAvailable, availabilityHours } = req.body;
      const update = { updatedBy: req.user._id };
      if (isAvailable !== undefined)    update.isAvailable      = isAvailable;
      if (availabilityHours)            update.availabilityHours = availabilityHours;

      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $set: update },
        { new: true }
      ).select('isAvailable availabilityHours');

      await invalidateTPCache(agency._id);
      return res.json({ success: true, message: 'Availability updated', data: agency });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/settings/settlement-cycle
 * Change settlement cycle preference
 */
router.patch(
  '/settings/settlement-cycle',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { settlementCycle } = req.body;
      const allowed = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];
      if (!allowed.includes(settlementCycle)) {
        return res.status(400).json({ success: false, message: `settlementCycle must be one of: ${allowed.join(', ')}` });
      }

      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $set: { settlementCycle, updatedBy: req.user._id } },
        { new: true }
      ).select('settlementCycle');

      await invalidateTPCache(agency._id);
      return res.json({ success: true, data: agency });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/security/sessions
 * View own audit sessions from User model
 */
router.get(
  '/security/sessions',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select('auditSessions deviceTokens lastLoginAt lastLoginIp loginCount');
      return res.json({ success: true, data: user });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/security/sessions/:sessionId
 * Revoke a specific session
 */
router.delete(
  '/security/sessions/:sessionId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { auditSessions: { _id: req.params.sessionId } } }
      );

      syslog({
        level: 'warning', category: 'security',
        message: `Session revoked by user ${req.user.name}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        request: { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
        metadata: { sessionId: req.params.sessionId },
      });

      return res.json({ success: true, message: 'Session revoked' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/security/sessions
 * Revoke ALL sessions except current
 */
router.delete(
  '/security/sessions',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      await User.findByIdAndUpdate(req.user._id, { $set: { auditSessions: [] } });

      syslog({
        level: 'warning', category: 'security',
        message: `All sessions revoked by ${req.user.name}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        request: { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'All sessions revoked' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/security/device-tokens/:tokenId
 * Remove a push notification device token
 */
router.delete(
  '/security/device-tokens/:tokenId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { deviceTokens: { _id: req.params.tokenId } } }
      );
      return res.json({ success: true, message: 'Device token removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §B  TRANSPORT PARTNER — VEHICLE MANAGEMENT (FULLY REFACTORED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/vehicles
 * List own vehicles with optional filters from the STANDALONE collection
 */
router.get(
  '/vehicles',
  transportPartnerRoutes,
  cache(60, (req) => `tp:${req.transportPartner.agency._id}:vehicles`),
  async (req, res) => {
    try {
      const { status, type, active } = req.query;
      const agencyId = req.transportPartner.agency._id;

      // Query standalone collection via polymorphic ref
      const filter = { ownerType: 'TransportPartner', ownerId: agencyId };
      if (status) filter.verificationStatus = status;
      if (type)   filter.vehicleType = type;
      if (active !== undefined) filter.status = active === 'true' ? 'active' : 'inactive';

      const vehicles = await Vehicle.find(filter)
        .populate('assignedDriver', 'legalName driverCode')
        .sort({ createdAt: -1 });

      return res.json({ success: true, count: vehicles.length, data: vehicles });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/vehicles/:vehicleId
 * Get single vehicle detail from the STANDALONE collection
 */
router.get(
  '/vehicles/:vehicleId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        ownerType: 'TransportPartner',
        ownerId: req.transportPartner.agency._id
      }).populate('assignedDriver', 'legalName driverCode phone');

      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      return res.json({ success: true, data: vehicle });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/vehicles
 * Add a new vehicle to the fleet
 */
router.post(
  '/vehicles',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agencyId = req.transportPartner.agency._id;

      const vehiclePayload = {
        ...req.body,
        ownerType: 'TransportPartner',
        ownerId: agencyId,
      };

      // Triggers Vehicle.post('save') hook to sync fleetInfo on TransportPartner
      const newVehicle = await Vehicle.create(vehiclePayload);

      await invalidateTPCache(agencyId);

      syslog({
        level: 'info', category: 'user',
        message: `Vehicle added: ${newVehicle.registrationNumber} by TransportPartner`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: agencyId },
        request: { method: 'POST', path: req.originalUrl, statusCode: 201 },
        metadata: { vehicleId: newVehicle._id, regNo: newVehicle.registrationNumber, type: newVehicle.vehicleType },
      });

      return res.status(201).json({ success: true, message: 'Vehicle added', data: newVehicle });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/vehicles/:vehicleId
 * Update vehicle details (non-verification fields)
 */
router.patch(
  '/vehicles/:vehicleId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agencyId = req.transportPartner.agency._id;

      // Prevent mutating ownership or verification audit trails
      const forbidden = [
        'verificationStatus', 'verifiedAt', 'verifiedBy', 'vehicleCode',
        'ownerType', 'ownerId', 'assignedDriver', 'assignedAt'
      ];
      const body = { ...req.body };
      forbidden.forEach((f) => delete body[f]);

      if (!Object.keys(body).length) {
        return res.status(400).json({ success: false, message: 'No valid fields to update' });
      }

      // Fetch, Mutate, and Save to ensure Mongoose post-save hooks (like fleet sync) trigger
      const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        ownerType: 'TransportPartner',
        ownerId: agencyId
      });

      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      Object.assign(vehicle, body);
      await vehicle.save(); // Triggers the fleet cache sync in Vehicle post-save

      await invalidateTPCache(agencyId);

      return res.json({ success: true, message: 'Vehicle updated', data: vehicle });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/vehicles/:vehicleId
 * Soft-delete vehicle (set status: inactive).
 * Hard-delete only allowed if vehicle is unassigned and unverified.
 */
router.delete(
  '/vehicles/:vehicleId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agencyId = req.transportPartner.agency._id;
      const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        ownerType: 'TransportPartner',
        ownerId: agencyId
      });

      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      const { hard } = req.query;
      if (hard === 'true' && vehicle.verificationStatus === 'pending' && !vehicle.assignedDriver) {
        await Vehicle.findByIdAndDelete(vehicle._id);
        
        // Manual cache sync since findByIdAndDelete doesn't trigger post('save') hooks natively 
        // unless handled specifically in the schema. (Fallback sync mechanism here)
        const counts = await Vehicle.aggregate([
          { $match: { ownerType: 'TransportPartner', ownerId: agencyId } },
          { $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'active'] }, { $eq: ['$verificationStatus', 'verified'] }] }, 1, 0] } }
            }
          }
        ]);
        
        await TransportPartner.findByIdAndUpdate(agencyId, {
          'fleetInfo.totalVehicles': counts[0]?.total ?? 0,
          'fleetInfo.activeVehicles': counts[0]?.active ?? 0
        });

        await invalidateTPCache(agencyId);
        return res.json({ success: true, message: 'Vehicle permanently removed' });
      }

      // Soft delete
      vehicle.status = 'inactive';
      await vehicle.save(); // Triggers the fleet cache sync in post-save

      await invalidateTPCache(agencyId);
      return res.json({ success: true, message: 'Vehicle deactivated' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/vehicles/:vehicleId/assign-driver
 * Assign a driver to a vehicle using Driver instance method to sync both sides
 */
router.patch(
  '/vehicles/:vehicleId/assign-driver',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { driverId } = req.body;
      const agencyId = req.transportPartner.agency._id;

      // Validate driver belongs to this agency
      const driver = await Driver.findOne({ _id: driverId, ownerAgency: agencyId });
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found in your agency' });

      // Ensure vehicle belongs to agency
      const vehicleExists = await Vehicle.exists({ _id: req.params.vehicleId, ownerType: 'TransportPartner', ownerId: agencyId });
      if (!vehicleExists) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      // Use the instance method defined in Driver Schema to keep caches in sync
      await driver.assignVehicle(req.params.vehicleId);

      await invalidateTPCache(agencyId);
      return res.json({ success: true, message: `Driver ${driver.legalName} assigned to vehicle` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/vehicles/:vehicleId/unassign-driver
 * Remove driver assignment from vehicle
 */
router.patch(
  '/vehicles/:vehicleId/unassign-driver',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agencyId = req.transportPartner.agency._id;
      const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, ownerType: 'TransportPartner', ownerId: agencyId });
      
      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      if (!vehicle.assignedDriver) return res.status(400).json({ success: false, message: 'Vehicle has no assigned driver' });

      // Clear Driver's cache
      await Driver.findByIdAndUpdate(vehicle.assignedDriver, { assignedVehicleId: null, assignedVehicleSnapshot: null });

      // Clear Vehicle source of truth
      vehicle.assignedDriver = null;
      vehicle.assignedAt = null;
      await vehicle.save();

      await invalidateTPCache(agencyId);
      return res.json({ success: true, message: 'Driver unassigned from vehicle' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/vehicles/:vehicleId/photos
 * Add photo URLs to a standalone vehicle
 */
router.post(
  '/vehicles/:vehicleId/photos',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { photoUrls } = req.body; // array of strings
      if (!Array.isArray(photoUrls) || !photoUrls.length) {
        return res.status(400).json({ success: false, message: 'photoUrls array is required' });
      }

      const vehicle = await Vehicle.findOneAndUpdate(
        { _id: req.params.vehicleId, ownerType: 'TransportPartner', ownerId: req.transportPartner.agency._id },
        { $push: { photos: { $each: photoUrls } } },
        { new: true }
      );

      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: `${photoUrls.length} photo(s) added` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §C  TRANSPORT PARTNER — DRIVER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/drivers
 * List all drivers in own agency (with optional status filter)
 */
router.get(
  '/drivers',
  transportPartnerRoutes,
  cache(60, (req) => `tp:${req.transportPartner.agency._id}:drivers:${req.query.status || 'all'}`),
  async (req, res) => {
    try {
      const { status, isActive, page = 1, limit = 20 } = req.query;
      const filter = { ownerAgency: req.transportPartner.agency._id };
      if (status)   filter.status   = status;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const [drivers, total] = await Promise.all([
        Driver.find(filter)
          .populate('user', 'name email phone avatar isOnline lastseen')
          .select('-kyc.aadhaarNumber -bankDetails.accountNumber -adminNotes')
          .sort({ createdAt: -1 })
          .skip((+page - 1) * +limit)
          .limit(+limit),
        Driver.countDocuments(filter),
      ]);

      return res.json({ success: true, count: drivers.length, total, page: +page, data: drivers });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/drivers/:driverId
 * Get single driver profile
 */
router.get(
  '/drivers/:driverId',
  transportPartnerRoutes,
  cache(30, (req) => `tp:${req.transportPartner.agency._id}:driver:${req.params.driverId}`),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({
        _id: req.params.driverId,
        ownerAgency: req.transportPartner.agency._id,
      })
        .populate('user', 'name email phone avatar isOnline lastseen')
        .populate('assignedVehicleId', 'registrationNumber vehicleType make model') // Populate standalone vehicle
        .select('-kyc.aadhaarNumber -bankDetails.accountNumber -adminNotes');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found in your agency' });
      return res.json({ success: true, data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/drivers
 * Register a new driver under this agency.
 */
router.post(
  '/drivers',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { 
        name, email, phone, password, 
        kyc, currentCity,
        ...driverData 
      } = req.body;

      const agencyId = req.transportPartner.agency._id;
      const agencyName = req.transportPartner.agency.businessName;

      // ── Guards ──────────────────────────────────────────────────────────────
      if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required to register a driver' });
      }

      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(409).json({ success: false, message: 'A user with this email already exists' });
      }

      // ── 1. Create linked User (role: driver) ───────────────────────────────
      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = await User.create({
        name,
        email,
        phone: phone?.replace(/\D/g, '').slice(-10),
        password: hashedPassword,
        role: 'driver',
        createdBy: req.user._id,
      });

      // ── 2. Create Driver document ──────────────────────────────────────────
      const driver = await Driver.create({
        user: newUser._id,
        ownerAgency: agencyId,
        legalName: name,
        email,
        phone: phone?.replace(/\D/g, '').slice(-10),
        currentCity: currentCity || 'Unknown',
        kyc: kyc || {
          aadhaarNumber: '000000000000',
          drivingLicenceNumber: 'PENDING',
          drivingLicenceExpiry: new Date(Date.now() + 365 * 86400000), 
        },
        status: 'Offline',
        ...driverData,
        createdBy: req.user._id,
      });

      // ── 3. Update Agency Reference & Cache ─────────────────────────────────
      await TransportPartner.findByIdAndUpdate(agencyId, {
        $addToSet: { drivers: driver._id },
        updatedBy: req.user._id,
      });

      await invalidateTPCache(agencyId);

      // ── 4. System log ──────────────────────────────────────────────────────
      syslog({
        level: 'success', category: 'user',
        message: `Driver registered: ${name} under ${agencyName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'Driver', entityId: driver._id, label: name },
        request: { method: 'POST', path: req.originalUrl, statusCode: 201 },
        metadata: { driverId: driver._id, userId: newUser._id, agencyId },
      });

      // ── 5. Welcome email using transactionalTemplate ───────────────────────
      const loginUrl = `${process.env.FRONTEND_URL}/login`;
      const welcomeHtml = transactionalTemplate({
        header: 'Driver Account — Likeson.in',
        title: `Welcome to the Fleet, ${name}! 🚛`,
        body: `
          <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.7;">
            Your driver account has been created by <strong style="color:#1e293b;">${agencyName}</strong>. 
            You can now log in to the Likeson Driver App using the credentials below.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:16px;border:1px solid #e2e8f0;">
            <tr>
              <td style="font-size:12px;color:#64748b;padding:5px 0;width:44%;font-weight:600;text-transform:uppercase;">Login Email</td>
              <td style="font-size:13px;font-weight:700;color:#1e293b;padding:5px 0;">${email}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#64748b;padding:5px 0;font-weight:600;text-transform:uppercase;">Temporary Password</td>
              <td style="padding:5px 0;">
                <span style="font-size:15px;font-weight:800;color:#0369a1;font-family:'Courier New',monospace;background:#e0f2fe;padding:3px 10px;border-radius:6px;border:1px solid #bae6fd;">
                  ${password}
                </span>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#64748b;padding:5px 0;font-weight:600;text-transform:uppercase;">Assigned Agency</td>
              <td style="font-size:13px;font-weight:700;color:#1e293b;padding:5px 0;">${agencyName}</td>
            </tr>
          </table>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
            <p style="margin:0;font-size:12px;color:#166534;line-height:1.6;">
              ✅ <strong>Ready to drive?</strong> Please log in and verify your Aadhaar and Driving Licence details to start receiving trips.
            </p>
          </div>
        `,
        buttonText: 'Login to Driver App',
        buttonLink: loginUrl,
      });

      sendEmail({ email, subject: `🚛 Welcome to Likeson — Your Driver Account is Ready`, html: welcomeHtml }).catch((e) => console.error('Driver Welcome Email Failed:', e.message));

      // ── 6. Response ────────────────────────────────────────────────────────
      return res.status(201).json({ success: true, message: 'Driver registered successfully', data: { driver, userId: newUser._id } });

    } catch (err) {
      console.error('Driver Registration Error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
    }
  }
);

/**
 * PATCH /api/transport/drivers/:driverId
 * Update driver contact/professional info (non-KYC fields)
 */
router.patch(
  '/drivers/:driverId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const forbidden = ['ownerAgency', 'soloPartner', 'user', 'isVerified', 'isBlocked', 'kyc', 'assignedVehicleId', 'assignedVehicleSnapshot'];
      forbidden.forEach((f) => delete req.body[f]);

      const driver = await Driver.findOneAndUpdate(
        { _id: req.params.driverId, ownerAgency: req.transportPartner.agency._id },
        { $set: { ...req.body, updatedBy: req.user._id } },
        { new: true, runValidators: true }
      ).select('-kyc.aadhaarNumber -bankDetails.accountNumber -adminNotes');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: 'Driver updated', data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/drivers/:driverId/toggle-active
 * Activate or deactivate a driver
 */
router.patch(
  '/drivers/:driverId/toggle-active',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ _id: req.params.driverId, ownerAgency: req.transportPartner.agency._id });
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      driver.isActive   = !driver.isActive;
      driver.updatedBy  = req.user._id;
      if (!driver.isActive) driver.status = 'Offline';
      await driver.save(); // Triggers driver fleetInfo sync hook

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: `Driver ${driver.isActive ? 'activated' : 'deactivated'}`, isActive: driver.isActive });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/drivers/:driverId/pause
 * Temporarily pause a driver (with duration)
 */
router.patch(
  '/drivers/:driverId/pause',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { pauseReason, pausedUntil } = req.body;
      
      const driver = await Driver.findOne({ _id: req.params.driverId, ownerAgency: req.transportPartner.agency._id });
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      driver.isPaused = true;
      driver.pauseReason = pauseReason;
      driver.pausedUntil = pausedUntil ? new Date(pausedUntil) : null;
      driver.status = 'Offline';
      driver.updatedBy = req.user._id;
      await driver.save();

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: 'Driver paused', data: { isPaused: driver.isPaused, pausedUntil: driver.pausedUntil } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/drivers/:driverId/unpause
 * Resume a paused driver
 */
router.patch(
  '/drivers/:driverId/unpause',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ _id: req.params.driverId, ownerAgency: req.transportPartner.agency._id });
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      driver.isPaused = false;
      driver.pauseReason = null;
      driver.pausedUntil = null;
      driver.updatedBy = req.user._id;
      await driver.save();

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: 'Driver unpaused' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/drivers/:driverId
 * Remove driver from agency (unlinks — does not delete User)
 */
router.delete(
  '/drivers/:driverId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agencyId = req.transportPartner.agency._id;
      const driver = await Driver.findOne({ _id: req.params.driverId, ownerAgency: agencyId });
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found in your agency' });

      if (driver.status === 'On-Trip') {
        return res.status(400).json({ success: false, message: 'Cannot remove a driver who is currently On-Trip' });
      }

      // Nullify agency link
      driver.ownerAgency = null;
      driver.status      = 'Offline';
      driver.isActive    = false;
      await driver.save(); // Sync hooks execute

      // Remove from agency drivers array
      await TransportPartner.findByIdAndUpdate(agencyId, {
        $pull: { drivers: driver._id }, updatedBy: req.user._id,
      });

      await invalidateTPCache(agencyId);

      syslog({
        level: 'warning', category: 'user',
        message: `Driver ${driver.legalName} removed from agency`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: agencyId },
        request: { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
        metadata: { driverId: driver._id },
      });

      return res.json({ success: true, message: 'Driver removed from agency' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/drivers/:driverId/performance
 * Driver performance stats
 */
router.get(
  '/drivers/:driverId/performance',
  transportPartnerRoutes,
  cache(120, (req) => `tp:${req.transportPartner.agency._id}:driver:${req.params.driverId}:perf`),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({
        _id: req.params.driverId,
        ownerAgency: req.transportPartner.agency._id,
      }).select('performance rewards.tier rewards.coinBalance driverCode legalName status');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
      return res.json({ success: true, data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §D  TRANSPORT PARTNER — BANK & SETTLEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/bank
 * Own bank details (sensitive account numbers excluded)
 */
router.get(
  '/bank',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agency = await TransportPartner.findById(req.transportPartner.agency._id)
        .select('bankDetails');
      // accountLast4 is exposed, full accountNumber is select:false
      return res.json({ success: true, data: agency.bankDetails });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/bank/accounts
 * Add a bank account
 */
router.post(
  '/bank/accounts',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { isPrimary } = req.body;

      // If this is primary, unset others
      if (isPrimary) {
        await TransportPartner.findByIdAndUpdate(
          req.transportPartner.agency._id,
          { $set: { 'bankDetails.bankAccounts.$[].isPrimary': false } }
        );
      }

      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $push: { 'bankDetails.bankAccounts': req.body }, updatedBy: req.user._id },
        { new: true, runValidators: true }
      ).select('bankDetails');

      await invalidateTPCache(agency._id);
      return res.status(201).json({ success: true, message: 'Bank account added', data: agency.bankDetails.bankAccounts });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/bank/accounts/:accountId/set-primary
 * Set a bank account as primary
 */
router.patch(
  '/bank/accounts/:accountId/set-primary',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agencyId = req.transportPartner.agency._id;

      // Unset all, then set this one
      await TransportPartner.findByIdAndUpdate(agencyId, {
        $set: { 'bankDetails.bankAccounts.$[].isPrimary': false },
      });
      await TransportPartner.findOneAndUpdate(
        { _id: agencyId, 'bankDetails.bankAccounts._id': req.params.accountId },
        { $set: { 'bankDetails.bankAccounts.$.isPrimary': true, updatedBy: req.user._id } }
      );

      await invalidateTPCache(agencyId);
      return res.json({ success: true, message: 'Primary bank account updated' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/bank/accounts/:accountId
 * Remove a bank account
 */
router.delete(
  '/bank/accounts/:accountId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $pull: { 'bankDetails.bankAccounts': { _id: req.params.accountId } }, updatedBy: req.user._id }
      );

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: 'Bank account removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/bank/upi
 * Add a UPI handle
 */
router.post(
  '/bank/upi',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $push: { 'bankDetails.upiHandles': req.body }, updatedBy: req.user._id },
        { new: true }
      ).select('bankDetails.upiHandles');

      await invalidateTPCache(agency._id);
      return res.status(201).json({ success: true, data: agency.bankDetails.upiHandles });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/bank/upi/:upiId
 * Remove a UPI handle
 */
router.delete(
  '/bank/upi/:upiId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $pull: { 'bankDetails.upiHandles': { _id: req.params.upiId } }, updatedBy: req.user._id }
      );

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: 'UPI handle removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/bank/preferred-method
 * Set preferred settlement method
 */
router.patch(
  '/bank/preferred-method',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { method } = req.body;
      const allowed = ['Bank Transfer', 'UPI', 'Cheque'];
      if (!allowed.includes(method)) {
        return res.status(400).json({ success: false, message: `method must be one of: ${allowed.join(', ')}` });
      }

      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $set: { 'bankDetails.preferredSettlementMethod': method, updatedBy: req.user._id } },
        { new: true }
      ).select('bankDetails.preferredSettlementMethod');

      await invalidateTPCache(agency._id);
      return res.json({ success: true, data: agency.bankDetails });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §E  TRANSPORT PARTNER — SERVICE ZONES & PRICING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/zones
 */
router.get(
  '/zones',
  transportPartnerRoutes,
  cache(120, (req) => `tp:${req.transportPartner.agency._id}:zones`),
  async (req, res) => {
    try {
      const agency = await TransportPartner.findById(req.transportPartner.agency._id)
        .select('serviceZones');
      return res.json({ success: true, data: agency.serviceZones });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/zones
 * Add a service zone
 */
router.post(
  '/zones',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $push: { serviceZones: req.body }, updatedBy: req.user._id },
        { new: true, runValidators: true }
      ).select('serviceZones');

      await invalidateTPCache(agency._id);
      return res.status(201).json({ success: true, data: agency.serviceZones });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/zones/:zoneId
 * Update a service zone
 */
router.patch(
  '/zones/:zoneId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const agency = await TransportPartner.findById(
        req.transportPartner.agency._id
      );

      if (!agency) {
        return res.status(404).json({
          success: false,
          message: 'Agency not found',
        });
      }

      const zone = agency.serviceZones.id(req.params.zoneId);

      if (!zone) {
        return res.status(404).json({
          success: false,
          message: 'Zone not found',
        });
      }

      Object.keys(req.body).forEach((key) => {
        zone[key] = req.body[key];
      });

      agency.updatedBy = req.user._id;

      await agency.save();

      await invalidateTPCache(req.transportPartner.agency._id);

      return res.json({
        success: true,
        message: 'Zone updated successfully',
        data: zone,
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

/**
 * DELETE /api/transport/zones/:zoneId
 */
router.delete(
  '/zones/:zoneId',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $pull: { serviceZones: { _id: req.params.zoneId } }, updatedBy: req.user._id }
      );

      await invalidateTPCache(req.transportPartner.agency._id);
      return res.json({ success: true, message: 'Service zone removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/pricing
 * Own pricing config + effective platform fee
 */
router.get(
  '/pricing',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const [agency, globalConfig] = await Promise.all([
        TransportPartner.findById(req.transportPartner.agency._id).select('pricing platformFeeOverride'),
        PlatformPricingConfig.getGlobal(),
      ]);

      const effectivePlatformFee = agency.platformFeeOverride ?? globalConfig.transport.platformFee;
      return res.json({ success: true, data: { pricing: agency.pricing, platformFeeOverride: agency.platformFeeOverride, effectivePlatformFee } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/pricing
 * Update own pricing (baseFare, per km, etc.)
 */
router.patch(
  '/pricing',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const allowed = ['baseFare', 'baseFarePerKm', 'minimumFare', 'waitingChargePerMin', 'freeWaitingMinutes', 'nightSurchargePercent', 'wheelchairSurcharge', 'currency'];
      const update  = {};
      allowed.forEach((f) => { if (req.body[f] !== undefined) update[`pricing.${f}`] = req.body[f]; });
      update.updatedBy = req.user._id;

      const agency = await TransportPartner.findByIdAndUpdate(
        req.transportPartner.agency._id,
        { $set: update },
        { new: true }
      ).select('pricing');

      await invalidateTPCache(agency._id);
      return res.json({ success: true, data: agency.pricing });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §G  TRANSPORT PARTNER — DASHBOARD STATS & ACTIVITY LOGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/dashboard
 * Aggregated stats for partner dashboard
 */
router.get(
  '/dashboard',
  transportPartnerRoutes,
  cache(120, (req) => `tp:${req.transportPartner.agency._id}:stats`),
  async (req, res) => {
    try {
      const agencyId = req.transportPartner.agency._id;

      const agency = await TransportPartner.findById(agencyId)
        .select('stats fleetInfo rating isAvailable partnershipStatus isOnboardingComplete bankDetails.pendingSettlementAmount bankDetails.totalSettledAmount');

      const [availableDrivers, onTripDrivers] = await Promise.all([
        Driver.countDocuments({ ownerAgency: agencyId, status: 'Available', isActive: true }),
        Driver.countDocuments({ ownerAgency: agencyId, status: 'On-Trip' }),
      ]);

      return res.json({
        success: true,
        data: {
          stats:                agency.stats,
          fleetInfo:            agency.fleetInfo,
          rating:               agency.rating,
          isAvailable:          agency.isAvailable,
          partnershipStatus:    agency.partnershipStatus,
          isOnboardingComplete: agency.isOnboardingComplete,
          totalVehicles:        agency.fleetInfo?.totalVehicles || 0,
          activeVehicles:       agency.fleetInfo?.activeVehicles || 0,
          pendingSettlement:    agency.bankDetails?.pendingSettlementAmount,
          totalSettled:         agency.bankDetails?.totalSettledAmount,
          liveDriverStats:      { availableDrivers, onTripDrivers },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/logs
 * Own activity logs from SystemLog (partner can see their own events)
 */
router.get(
  '/logs',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, category, level } = req.query;
      const filter = { 'actor.userId': req.user._id };
      if (category) filter.category = category;
      if (level)    filter.level    = level;

      const [logs, total] = await Promise.all([
        SystemLog.find(filter)
          .sort({ createdAt: -1 })
          .skip((+page - 1) * +limit)
          .limit(+limit)
          .select('-sensitivePayload'),
        SystemLog.countDocuments(filter),
      ]);

      return res.json({ success: true, total, page: +page, count: logs.length, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/drivers/:driverId/logs
 * Activity logs for a specific driver under this agency
 */
router.get(
  '/drivers/:driverId/logs',
  transportPartnerRoutes,
  async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      // Verify driver belongs to agency
      const driver = await Driver.findOne({
        _id: req.params.driverId, ownerAgency: req.transportPartner.agency._id,
      }).select('user legalName');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found in your agency' });

      const filter = { 'actor.userId': driver.user };
      const [logs, total] = await Promise.all([
        SystemLog.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit).select('-sensitivePayload'),
        SystemLog.countDocuments(filter),
      ]);

      return res.json({ success: true, driverName: driver.legalName, total, page: +page, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §H  DRIVER ROUTES (driver manages own profile)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/driver/me
 * Driver's own profile
 */
router.get(
  '/driver/me',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id })
        .populate('user', 'name email phone avatar isOnline lastseen')
        .populate('ownerAgency', 'businessName ownerPhone')
        .select('-kyc.aadhaarNumber -bankDetails.accountNumber');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found' });
      return res.json({ success: true, data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/me
 * Driver updates own contact / professional info
 */
router.patch(
  '/driver/me',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const forbidden = ['ownerAgency', 'soloPartner', 'user', 'isVerified', 'isBlocked', 'kyc', 'rewards', 'performance', 'assignedVehicleId', 'assignedVehicleSnapshot'];
      forbidden.forEach((f) => delete req.body[f]);

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: { ...req.body, updatedBy: req.user._id } },
        { new: true, runValidators: true }
      ).select('-kyc.aadhaarNumber -bankDetails.accountNumber -adminNotes');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found' });
      return res.json({ success: true, message: 'Profile updated', data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /api/transport/driver/kyc
 * Driver submits own KYC documents
 */
router.put(
  '/driver/kyc',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const kycFields = [
        'aadhaarNumber', 'aadhaarDocUrl',
        'drivingLicenceNumber', 'drivingLicenceExpiry', 'drivingLicenceDocUrl', 'licenceClass',
        'psvBadgeNumber', 'psvBadgeExpiry', 'psvBadgeDocUrl',
        'panNumber', 'panDocUrl',
      ];

      const kycUpdate = {};
      kycFields.forEach((f) => {
        if (req.body[f] !== undefined) kycUpdate[`kyc.${f}`] = req.body[f];
      });

      // Advance to Under-Review when docs provided
      if (req.body.aadhaarDocUrl || req.body.drivingLicenceDocUrl) {
        kycUpdate['kyc.verificationStatus'] = 'Under-Review';
        kycUpdate['kyc.submittedAt']        = new Date();
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: { ...kycUpdate, updatedBy: req.user._id } },
        { new: true, runValidators: true }
      ).select('kyc');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      syslog({
        level: 'info', category: 'kyc',
        message: `Driver KYC documents submitted`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
        request: { method: 'PUT', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'KYC submitted for review', data: { verificationStatus: driver.kyc.verificationStatus } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/shift
 * Driver updates own shift/availability
 */
router.patch(
  '/driver/shift',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { shiftType, startTime, endTime, daysAvailable, isAvailableNow, nextAvailableAt } = req.body;
      const shiftUpdate = {};
      if (shiftType)       shiftUpdate['shift.shiftType']       = shiftType;
      if (startTime)       shiftUpdate['shift.startTime']       = startTime;
      if (endTime)         shiftUpdate['shift.endTime']         = endTime;
      if (daysAvailable)   shiftUpdate['shift.daysAvailable']   = daysAvailable;
      if (isAvailableNow !== undefined) shiftUpdate['shift.isAvailableNow'] = isAvailableNow;
      if (nextAvailableAt) shiftUpdate['shift.nextAvailableAt'] = new Date(nextAvailableAt);

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: shiftUpdate },
        { new: true }
      ).select('shift status');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
      return res.json({ success: true, data: driver.shift });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/status
 * Driver updates own status (Available / Offline / On-Break)
 */
router.patch(
  '/driver/status',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = ['Available', 'Offline', 'On-Break'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id, isActive: true, isBlocked: false, isPaused: false },
        { $set: { status } },
        { new: true }
      ).select('status isActive');

      if (!driver) return res.status(400).json({ success: false, message: 'Driver is not active or is blocked/paused' });
      return res.json({ success: true, status: driver.status });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/location
 * Driver updates live GPS location
 */
router.patch(
  '/driver/location',
  protect,
  authorize('driver'),
  async (req, res) => {
    try {
      const { lng, lat, heading, speedKmh } = req.body;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        return res.status(400).json({ success: false, message: 'lng and lat (numbers) are required' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        {
          $set: {
            'location.coordinates': [lng, lat],
            'location.heading':     heading,
            'location.speedKmh':    speedKmh,
            'location.updatedAt':   new Date(),
          },
        },
        { new: true }
      ).select('location status');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
      return res.json({ success: true, data: driver.location });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/driver/rewards
 * Driver's own coins, badges, tier
 */
router.get(
  '/driver/rewards',
  protect,
  authorize('driver'),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id }).select('rewards performance.performanceTier driverCode');
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
      return res.json({ success: true, data: driver.rewards });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /api/transport/driver/bank
 * Driver updates own bank details
 */
router.put(
  '/driver/bank',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body;
      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: { bankDetails: { accountHolderName, accountNumber, ifscCode, bankName, upiId }, updatedBy: req.user._id } },
        { new: true, runValidators: true }
      ).select('bankDetails.accountLast4 bankDetails.bankName bankDetails.upiId bankDetails.isBankVerified');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
      return res.json({ success: true, message: 'Bank details updated', data: driver.bankDetails });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/driver/logs
 * Driver's own activity logs
 */
router.get(
  '/driver/logs',
  protect,
  authorize('driver'),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, category } = req.query;
      const filter = { 'actor.userId': req.user._id };
      if (category) filter.category = category;

      const [logs, total] = await Promise.all([
        SystemLog.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit).select('-sensitivePayload'),
        SystemLog.countDocuments(filter),
      ]);

      return res.json({ success: true, total, page: +page, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// §H (extended)  DRIVER — ADDITIONAL SELF-SERVICE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/transport/driver/me/photo
 * Driver uploads / replaces their profile photo URL
 */
router.patch(
  '/driver/me/photo',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { photoUrl } = req.body;
      if (!photoUrl) {
        return res.status(400).json({ success: false, message: 'photoUrl is required' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: { photoUrl, updatedBy: req.user._id } },
        { new: true }
      ).select('photoUrl');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      // Keep the linked User avatar in sync
      await User.findByIdAndUpdate(req.user._id, { $set: { avatar: photoUrl } });

      return res.json({ success: true, message: 'Profile photo updated', data: { photoUrl: driver.photoUrl } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/driver/me/photo
 * Remove profile photo — resets to role-default avatar
 */
router.delete(
  '/driver/me/photo',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const defaultAvatar = 'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_59%20AM.png?updatedAt=1770615249818';

      await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: { photoUrl: null, updatedBy: req.user._id } }
      );

      await User.findByIdAndUpdate(req.user._id, { $set: { avatar: defaultAvatar } });

      return res.json({ success: true, message: 'Profile photo removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/me/emergency
 * Driver updates own emergency contact
 */
router.patch(
  '/driver/me/emergency',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { name, relationship, phone } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ success: false, message: 'name and phone are required' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        {
          $set: {
            emergencyContact: { name, relationship, phone },
            updatedBy: req.user._id,
          },
        },
        { new: true, runValidators: true }
      ).select('emergencyContact');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      return res.json({ success: true, message: 'Emergency contact updated', data: driver.emergencyContact });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/me/notifs
 * Driver updates notification preferences
 */
router.patch(
  '/driver/me/notifs',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { smsAlerts, whatsappAlerts, pushNotifications } = req.body;

      const update = {};
      if (smsAlerts !== undefined)         update['notifPrefs.smsAlerts']         = smsAlerts;
      if (whatsappAlerts !== undefined)     update['notifPrefs.whatsappAlerts']     = whatsappAlerts;
      if (pushNotifications !== undefined)  update['notifPrefs.pushNotifications']  = pushNotifications;

      if (!Object.keys(update).length) {
        return res.status(400).json({ success: false, message: 'No valid preference fields provided' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: { ...update, updatedBy: req.user._id } },
        { new: true }
      ).select('notifPrefs');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      return res.json({ success: true, message: 'Notification preferences updated', data: driver.notifPrefs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/driver/me/performance
 * Driver reads their own performance summary
 */
router.get(
  '/driver/me/performance',
  protect,
  authorize('driver'),
  cache(120, (req) => `driver:${req.user._id}:performance`),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id })
        .select('performance rewards.tier rewards.coinBalance driverCode legalName status profileCompletionPercent');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      return res.json({ success: true, data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/driver/me/coins
 * Driver views full coin transaction history
 */
router.get(
  '/driver/me/coins',
  protect,
  authorize('driver'),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, type } = req.query;

      const driver = await Driver.findOne({ user: req.user._id })
        .select('rewards.coinBalance rewards.totalCoinsEarned rewards.totalCoinsRedeem rewards.coinTransactions rewards.tier rewards.badges');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      let txns = driver.rewards.coinTransactions;
      if (type) txns = txns.filter((t) => t.type === type);

      // Manual pagination on the embedded array
      const total  = txns.length;
      const paged  = txns
        .slice()
        .reverse()  // newest first
        .slice((+page - 1) * +limit, +page * +limit);

      return res.json({
        success: true,
        data: {
          coinBalance:      driver.rewards.coinBalance,
          totalCoinsEarned: driver.rewards.totalCoinsEarned,
          totalCoinsRedeem: driver.rewards.totalCoinsRedeem,
          tier:             driver.rewards.tier,
          badges:           driver.rewards.badges,
          transactions:     { total, page: +page, count: paged.length, data: paged },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/driver/me/certs
 * Driver adds a training certificate
 */
router.post(
  '/driver/me/certs',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { name, issuedBy, issuedAt, expiresAt, documentUrl } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Certificate name is required' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        {
          $push: { trainingCertificates: { name, issuedBy, issuedAt, expiresAt, documentUrl } },
          $set:  { updatedBy: req.user._id },
        },
        { new: true, runValidators: true }
      ).select('trainingCertificates');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      const added = driver.trainingCertificates[driver.trainingCertificates.length - 1];
      return res.status(201).json({ success: true, message: 'Certificate added', data: added });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/driver/me/certs/:certId
 * Driver removes a training certificate
 */
router.delete(
  '/driver/me/certs/:certId',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        {
          $pull: { trainingCertificates: { _id: req.params.certId } },
          $set:  { updatedBy: req.user._id },
        },
        { new: true }
      ).select('trainingCertificates');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      return res.json({ success: true, message: 'Certificate removed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/kyc/document
 * Driver re-uploads a single KYC document URL
 */
router.patch(
  '/driver/kyc/document',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const allowedDocs = ['aadhaarDocUrl', 'drivingLicenceDocUrl', 'psvBadgeDocUrl', 'panDocUrl'];
      const updates = {};

      allowedDocs.forEach((field) => {
        if (req.body[field]) updates[`kyc.${field}`] = req.body[field];
      });

      if (!Object.keys(updates).length) {
        return res.status(400).json({
          success: false,
          message: `Provide at least one of: ${allowedDocs.join(', ')}`,
        });
      }

      updates['kyc.verificationStatus'] = 'Under-Review';
      updates['kyc.submittedAt']        = new Date();
      updates['kyc.rejectionReason']    = null;
      updates.updatedBy                 = req.user._id;

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
      ).select('kyc.verificationStatus kyc.aadhaarDocUrl kyc.drivingLicenceDocUrl kyc.psvBadgeDocUrl kyc.panDocUrl kyc.submittedAt');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      syslog({
        level: 'info', category: 'kyc',
        message: 'Driver KYC document(s) re-uploaded',
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
        metadata: { updatedDocs: Object.keys(req.body).filter((k) => allowedDocs.includes(k)) },
      });

      return res.json({
        success: true,
        message: 'Document(s) submitted for re-review',
        data: driver.kyc,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/kyc/licence-numbers
 * Driver updates licence/badge numbers (non-document fields).
 */
router.patch(
  '/driver/kyc/licence-numbers',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const allowed = [
        'drivingLicenceNumber', 'drivingLicenceExpiry', 'licenceClass',
        'psvBadgeNumber', 'psvBadgeExpiry', 'panNumber',
      ];

      const updates = {};
      allowed.forEach((f) => {
        if (req.body[f] !== undefined) updates[`kyc.${f}`] = req.body[f];
      });

      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, message: `Provide at least one of: ${allowed.join(', ')}` });
      }

      updates['kyc.verificationStatus'] = 'Under-Review';
      updates['kyc.submittedAt']        = new Date();
      updates['kyc.rejectionReason']    = null;
      updates.updatedBy                 = req.user._id;

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
      ).select('kyc.drivingLicenceNumber kyc.drivingLicenceExpiry kyc.licenceClass kyc.psvBadgeNumber kyc.psvBadgeExpiry kyc.verificationStatus');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      return res.json({ success: true, message: 'Licence details updated and submitted for review', data: driver.kyc });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PUT /api/transport/driver/medical-fitness
 * Driver submits / updates medical fitness certificate
 */
router.put(
  '/driver/medical-fitness',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const {
        certificateNumber, issuedBy, issuedAt,
        expiryDate, documentUrl, bloodGroup,
      } = req.body;

      const update = {};
      if (certificateNumber) update['medicalFitness.certificateNumber'] = certificateNumber;
      if (issuedBy)          update['medicalFitness.issuedBy']          = issuedBy;
      if (issuedAt)          update['medicalFitness.issuedAt']          = new Date(issuedAt);
      if (expiryDate)        update['medicalFitness.expiryDate']        = new Date(expiryDate);
      if (documentUrl)       update['medicalFitness.documentUrl']       = documentUrl;
      if (bloodGroup)        update['medicalFitness.bloodGroup']        = bloodGroup;

      if (certificateNumber || expiryDate) {
        const driver = await Driver.findOne({ user: req.user._id }).select('medicalFitness');
        const merged = { ...driver?.medicalFitness?.toObject?.() ?? {}, ...update };
        const isValid = !!(merged['medicalFitness.certificateNumber'] ?? merged.certificateNumber) &&
                        !!(merged['medicalFitness.expiryDate'] ?? merged.expiryDate) &&
                        new Date(merged['medicalFitness.expiryDate'] ?? merged.expiryDate) > new Date();
        update['medicalFitness.isValid'] = isValid;
      }

      update.updatedBy = req.user._id;

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: update },
        { new: true, runValidators: true }
      ).select('medicalFitness');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      syslog({
        level: 'info', category: 'kyc',
        message: 'Driver medical fitness certificate updated',
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
        request: { method: 'PUT', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'Medical fitness updated', data: driver.medicalFitness });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/driver/me/compliance
 * Driver checks their own compliance summary
 */
router.get(
  '/driver/me/compliance',
  protect,
  authorize('driver'),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id })
        .select('kyc.verificationStatus kyc.drivingLicenceExpiry kyc.psvBadgeExpiry medicalFitness.expiryDate medicalFitness.isValid isVerified isBlocked isPaused profileCompletionPercent');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      const now  = new Date();
      const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const flag = (date) => {
        if (!date) return { status: 'missing', daysLeft: null };
        const d       = new Date(date);
        const expired = d < now;
        const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
        return {
          status:   expired ? 'expired' : d < soon ? 'expiring_soon' : 'valid',
          expiresAt: d,
          daysLeft:  expired ? 0 : daysLeft,
        };
      };

      return res.json({
        success: true,
        data: {
          kycStatus:            driver.kyc.verificationStatus,
          isVerified:           driver.isVerified,
          isBlocked:            driver.isBlocked,
          isPaused:             driver.isPaused,
          profileCompletion:    driver.profileCompletionPercent,
          drivingLicence:       flag(driver.kyc?.drivingLicenceExpiry),
          psvBadge:             flag(driver.kyc?.psvBadgeExpiry),
          medicalFitness: {
            ...flag(driver.medicalFitness?.expiryDate),
            isValid: driver.medicalFitness?.isValid ?? false,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/driver/onboarding
 * Driver updates their own onboarding step / terms agreement.
 */
router.patch(
  '/driver/onboarding',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const { step, agreedToTerms } = req.body;

      const update = { updatedBy: req.user._id };
      if (step !== undefined)   update['onboarding.step'] = step;

      if (agreedToTerms) {
        update['onboarding.agreedToTermsAt'] = new Date();
        update['onboarding.agreedToTermsIp'] = req.deviceInfo?.ipAddress || null;
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: update },
        { new: true }
      ).select('onboarding profileCompletionPercent');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      return res.json({ success: true, data: driver.onboarding });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/driver/onboarding/complete
 * Mark onboarding as complete (only if profile completion >= 70%).
 */
router.post(
  '/driver/onboarding/complete',
  protect,
  getDeviceInfo,
  authorize('driver'),
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id })
        .select('onboarding profileCompletionPercent kyc.verificationStatus');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      if (driver.profileCompletionPercent < 70) {
        return res.status(400).json({
          success: false,
          message: `Profile must be at least 70% complete (currently ${driver.profileCompletionPercent}%)`,
        });
      }

      driver.onboarding.isComplete  = true;
      driver.onboarding.completedAt = new Date();
      driver.onboarding.step        = 99;
      driver.updatedBy              = req.user._id;
      await driver.save();

      syslog({
        level: 'success', category: 'user',
        message: `Driver onboarding marked complete`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
        request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'Onboarding complete', data: driver.onboarding });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §I  ADMIN / SUPERADMIN — PARTNER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

const adminOnly  = [protect, getDeviceInfo, authorize('admin', 'superadmin')];
const superOnly  = [protect, getDeviceInfo, authorize('superadmin')];

/**
 * GET /api/transport/admin/partners
 * List all TransportPartners with filters and pagination
 */
router.get(
  '/admin/partners',
  adminOnly,
  cache(60, (req) => `admin:tp:list:${JSON.stringify(req.query)}`),
  async (req, res) => {
    try {
      const {
        page = 1, limit = 20, status, city, kycStatus, search,
        sortBy = 'createdAt', sortOrder = '-1',
      } = req.query;

      const filter = {};
      if (status)    filter.partnershipStatus      = status;
      if (city)      filter['serviceZones.city']   = new RegExp(city, 'i');
      if (kycStatus) filter['ownerKyc.kycStatus']  = kycStatus;
      if (search) {
        filter.$or = [
          { businessName: new RegExp(search, 'i') },
          { ownerName:    new RegExp(search, 'i') },
          { ownerPhone:   new RegExp(search, 'i') },
          { ownerEmail:   new RegExp(search, 'i') },
        ];
      }

      const [partners, total] = await Promise.all([
        TransportPartner.find(filter)
          .populate('user', 'name email phone avatar isOnline')
          .select('-internalNotes -panNumber -bankDetails.bankAccounts.accountNumber -ownerKyc.aadhaarNumber -ownerKyc.panNumber')
          .sort({ [sortBy]: +sortOrder })
          .skip((+page - 1) * +limit)
          .limit(+limit),
        TransportPartner.countDocuments(filter),
      ]);

      return res.json({ success: true, total, page: +page, count: partners.length, data: partners });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/admin/partners/:partnerId
 * Get single partner full detail (admin view)
 */
router.get(
  '/admin/partners/:partnerId',
  adminOnly,
  cache(30, (req) => `admin:tp:${req.params.partnerId}`),
  async (req, res) => {
    try {
      const partner = await TransportPartner.findById(req.params.partnerId)
        .populate('user', 'name email phone avatar isOnline lastseen loginCount lastLoginAt lastLoginIp')
        .populate('drivers', 'legalName status isActive kyc.verificationStatus driverCode')
        .select('-bankDetails.bankAccounts.accountNumber');

      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });
      return res.json({ success: true, data: partner });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/admin/partners
 * Admin / Superadmin — Create a new TransportPartner (and linked User account)
 */
router.post(
  '/admin/partners',
  adminOnly,
  async (req, res) => {
    try {
      const {
        name, email, phone, password,
        businessName, ownerName, ownerPhone, ownerEmail,
        businessType, registeredAddress, gstNumber, panNumber,
        msmeUdyamNumber, serviceZones, pricing, settlementCycle,
        notifications, partnershipStatus,
      } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'email and password are required' });
      }

      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(409).json({ success: false, message: 'A user with this email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = await User.create({
        name:      name      || ownerName,
        email,
        phone:     phone     || ownerPhone,
        password:  hashedPassword,
        role:      'transportpartner',
        createdBy: req.user._id,
      });

      const partner = await TransportPartner.create({
        user:              newUser._id,
        businessName:      businessName || name || ownerName,
        ownerName:         ownerName    || name,
        ownerPhone:        ownerPhone   || phone,
        ownerEmail:        ownerEmail   || email,
        businessType:      businessType || 'proprietorship',
        registeredAddress: registeredAddress || {},
        gstNumber,
        panNumber,
        msmeUdyamNumber,
        serviceZones:      serviceZones  || [],
        pricing:           pricing       || {},
        settlementCycle:   settlementCycle || 'Weekly',
        notifications:     notifications  || { sms: true, email: true, push: true, whatsapp: true },
        partnershipStatus: partnershipStatus || 'pending',
        createdBy: req.user._id,
      });

      await invalidatePattern('admin:tp:list*');

      syslog({
        level:    'success', category: 'user',
        message:  `TransportPartner created by admin: ${partner.businessName}`,
        actor: { userId: req.user._id, name:   req.user.name, role:   req.user.role, ip:     req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: partner._id, label: partner.businessName },
        request: { method: 'POST', path: req.originalUrl, statusCode: 201 },
      });

      const loginUrl     = `${process.env.FRONTEND_URL}/login`;
      const ownerDisplay = partner.ownerName || name || 'Partner';
      const bizDisplay   = partner.businessName;

      const welcomeHtml = transactionalTemplate({
        header:     'Transport Partner Account — Likeson.in',
        title:      `Welcome aboard, ${ownerDisplay}! 🎉`,
        body: `
          <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.7;">
            Your Transport Partner account for <strong style="color:#1e293b;">${bizDisplay}</strong>
            has been created by the Likeson admin team. Use the credentials below to sign in.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin-bottom:16px;border:1px solid #e2e8f0;">
            <tr><td style="font-size:12px;color:#64748b;padding:5px 0;width:44%;font-weight:600;text-transform:uppercase;">Login Email</td>
                <td style="font-size:13px;font-weight:700;color:#1e293b;padding:5px 0;">${email}</td></tr>
            <tr><td style="font-size:12px;color:#64748b;padding:5px 0;font-weight:600;text-transform:uppercase;">Password</td>
                <td style="padding:5px 0;"><span style="font-size:15px;font-weight:800;color:#92400e;font-family:'Courier New',monospace;letter-spacing:2px;background:#fef3c7;padding:3px 10px;border-radius:6px;border:1px solid #fde68a;">${password}</span></td></tr>
          </table>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
            <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">⚠️ <strong>Change your password after first login.</strong></p>
          </div>
        `,
        buttonText: 'Sign In to Your Account →',
        buttonLink: loginUrl,
      });

      sendEmail({ email, subject: `🎉 Welcome to Likeson — Your Transport Partner Account is Ready`, html: welcomeHtml }).catch(() => {});

      return res.status(201).json({ success: true, message: 'Transport partner created successfully', data: { partner, userId: newUser._id } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/partners/:partnerId
 * Admin / Superadmin — Update any field on a TransportPartner
 */
router.patch(
  '/admin/partners/:partnerId',
  adminOnly,
  async (req, res) => {
    try {
      const forbidden = [
        '_id', 'user', 'vehicles', 'drivers',
        'stats', 'fleetInfo', 'createdAt',
        'partnershipStatus', 'ownerKyc', 'platformFeeOverride', 'internalNotes',
      ];
      forbidden.forEach((f) => delete req.body[f]);

      const flattenObject = (obj, prefix = '') =>
        Object.keys(obj).reduce((acc, key) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
            Object.assign(acc, flattenObject(obj[key], fullKey));
          } else {
            acc[fullKey] = obj[key];
          }
          return acc;
        }, {});

      const updatePayload = flattenObject(req.body);
      updatePayload.updatedBy = req.user._id;

      if (Object.keys(updatePayload).length === 1) {
        return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
      }

      const partner = await TransportPartner.findByIdAndUpdate(
        req.params.partnerId,
        { $set: updatePayload },
        { new: true, runValidators: true }
      ).populate('user', 'name email phone avatar isOnline')
       .select('-internalNotes -panNumber -bankDetails.bankAccounts.accountNumber -ownerKyc.aadhaarNumber -ownerKyc.panNumber');

      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

      await invalidateTPCache(partner._id);
      await invalidatePattern('admin:tp:list*');

      syslog({
        level: 'info', category: 'user',
        message: `TransportPartner updated by admin: ${partner.businessName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: partner._id, label: partner.businessName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'Partner updated successfully', data: partner });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
); 

/**
 * PATCH /api/transport/admin/partners/:partnerId/status
 * Change partnershipStatus (approve / suspend / reject)
 */
router.patch(
  '/admin/partners/:partnerId/status',
  adminOnly,
  async (req, res) => {
    try {
      const { status, reason } = req.body;
      const allowed = ['pending', 'under-review', 'active', 'suspended', 'rejected'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
      }

      const update = { partnershipStatus: status, updatedBy: req.user._id };
      if (status === 'active') {
        update.verifiedAt      = new Date();
        update.verifiedBy      = req.user._id;
        update.partnerSince    = new Date();
        update.rejectionReason = null;
      }
      if (['suspended', 'rejected'].includes(status)) {
        update.rejectionReason = reason || 'Administrative action';
      }

      const partner = await TransportPartner.findByIdAndUpdate(
        req.params.partnerId,
        { $set: update },
        { new: true }
      ).select('businessName partnershipStatus ownerEmail ownerName');

      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

      await invalidateTPCache(partner._id);
      await invalidatePattern('admin:tp:list*');

      if (partner.ownerEmail) {
        const subjectMap = { active: '✅ Partnership Approved', suspended: '⚠️ Account Suspended', rejected: '❌ Application Rejected' };
        if (subjectMap[status]) {
          sendEmail({ email: partner.ownerEmail, subject: subjectMap[status], html: `<p>Dear ${partner.ownerName}, your account status has been updated to: <strong>${status}</strong>. ${reason ? `Reason: ${reason}` : ''}</p>` }).catch(() => {});
        }
      }

      syslog({
        level: status === 'active' ? 'success' : 'warning', category: 'user',
        message: `TransportPartner ${partner.businessName} status changed to ${status}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: partner._id, label: partner.businessName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: `Partner status updated to ${status}`, data: partner });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/partners/:partnerId/kyc
 * Admin verifies / rejects owner KYC
 */
router.patch(
  '/admin/partners/:partnerId/kyc',
  adminOnly,
  async (req, res) => {
    try {
      const { kycStatus, aadhaarVerified, panVerified, rejectionReason } = req.body;

      const update = { updatedBy: req.user._id };
      if (kycStatus)                         update['ownerKyc.kycStatus']         = kycStatus;
      if (aadhaarVerified !== undefined)      update['ownerKyc.aadhaarVerified']   = aadhaarVerified;
      if (panVerified !== undefined)          update['ownerKyc.panVerified']       = panVerified;
      if (kycStatus === 'verified') {
        update['ownerKyc.kycVerifiedAt']     = new Date();
        update['ownerKyc.kycVerifiedBy']     = req.user._id;
      }
      if (kycStatus === 'rejected') {
        update['ownerKyc.kycRejectionReason'] = rejectionReason;
      }

      const partner = await TransportPartner.findByIdAndUpdate(
        req.params.partnerId,
        { $set: update },
        { new: true }
      ).select('businessName ownerKyc.kycStatus ownerEmail ownerName');

      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

      await invalidateTPCache(partner._id);

      return res.json({ success: true, message: `KYC status set to ${kycStatus}`, data: partner.ownerKyc });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/partners/:partnerId/internal-notes
 * Admin adds internal notes
 */
router.patch(
  '/admin/partners/:partnerId/internal-notes',
  adminOnly,
  async (req, res) => {
    try {
      const partner = await TransportPartner.findByIdAndUpdate(
        req.params.partnerId,
        { $set: { internalNotes: req.body.notes, updatedBy: req.user._id } },
        { new: true }
      ).select('businessName internalNotes');

      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });
      return res.json({ success: true, data: { internalNotes: partner.internalNotes } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/transport/admin/partners/:partnerId
 * Superadmin-only: hard delete a partner (and their drivers)
 */
router.delete(
  '/admin/partners/:partnerId',
  superOnly,
  async (req, res) => {
    try {
      const partner = await TransportPartner.findById(req.params.partnerId);
      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

      // Unlink all drivers
      await Driver.updateMany(
        { ownerAgency: partner._id },
        { $set: { ownerAgency: null, isActive: false, status: 'Offline' } }
      );

      // Unlink or delete vehicles from standalone collection
      await Vehicle.deleteMany({ ownerType: 'TransportPartner', ownerId: partner._id });

      await TransportPartner.findByIdAndDelete(partner._id);
      await invalidateTPCache(partner._id);
      await invalidatePattern('admin:tp:list*');

      syslog({
        level: 'error', category: 'user',
        message: `TransportPartner DELETED: ${partner.businessName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: partner._id, label: partner.businessName },
        request: { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'Partner and associated records deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §J  ADMIN — VEHICLE VERIFICATION (REFACTORED FOR STANDALONE COLLECTION)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/admin/vehicles/pending
 * List all vehicles pending verification across all partners from standalone collection
 */
router.get(
  '/admin/vehicles/pending',
  adminOnly,
  cache(60, () => 'admin:vehicles:pending'),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, type, ownerType } = req.query;
      
      const filter = { verificationStatus: { $in: ['pending', 'under-review'] } };
      if (type) filter.vehicleType = type;
      if (ownerType) filter.ownerType = ownerType;

      const [vehicles, total] = await Promise.all([
        Vehicle.find(filter)
          .populate({
            path: 'ownerId',
            select: 'businessName ownerName ownerPhone name phone partnerCode', // Supports both TransportPartner & SoloDriverPartner dynamically
          })
          .sort({ createdAt: -1 })
          .skip((+page - 1) * +limit)
          .limit(+limit),
        Vehicle.countDocuments(filter)
      ]);

      return res.json({ success: true, count: vehicles.length, total, page: +page, data: vehicles });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/vehicles/:vehicleId/verify
 * Verify or reject a specific vehicle
 * Note: Since Vehicle is standalone, we no longer strictly need partnerId in the URL param
 */
router.patch(
  '/admin/vehicles/:vehicleId/verify',
  adminOnly,
  async (req, res) => {
    try {
      const { verificationStatus, rejectionReason } = req.body;
      const allowed = ['under-review', 'verified', 'rejected'];
      if (!allowed.includes(verificationStatus)) {
        return res.status(400).json({ success: false, message: `verificationStatus must be one of: ${allowed.join(', ')}` });
      }

      const vehicle = await Vehicle.findById(req.params.vehicleId);
      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      vehicle.verificationStatus = verificationStatus;
      vehicle.verifiedBy = req.user._id;
      
      if (verificationStatus === 'verified') vehicle.verifiedAt = new Date();
      if (verificationStatus === 'rejected') vehicle.rejectionReason = rejectionReason;

      // Executing save() triggers the post-save hooks to sync fleetInfo on the owner document!
      await vehicle.save(); 

      // Invalidate relevant partner cache dynamically
      if (vehicle.ownerType === 'TransportPartner') {
        await invalidateTPCache(vehicle.ownerId);
      }
      await invalidateKey('admin:vehicles:pending');

      syslog({
        level: verificationStatus === 'verified' ? 'success' : 'warning', category: 'kyc',
        message: `Vehicle ${verificationStatus}: ${vehicle.registrationNumber}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'Vehicle', entityId: vehicle._id, label: vehicle.registrationNumber },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
        metadata: { vehicleId: vehicle._id, verificationStatus },
      });

      return res.json({ success: true, message: `Vehicle ${verificationStatus}`, data: vehicle });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §K  ADMIN — DRIVER MANAGEMENT (platform-wide)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/admin/drivers
 * List all drivers across all agencies
 */
router.get(
  '/admin/drivers',
  adminOnly,
  cache(60, (req) => `admin:drivers:list:${JSON.stringify(req.query)}`),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status, kycStatus, agencyId, search } = req.query;

      const filter = {};
      if (status)   filter.status = status;
      if (agencyId) filter.ownerAgency = agencyId;
      if (kycStatus) filter['kyc.verificationStatus'] = kycStatus;
      if (search) {
        filter.$or = [
          { legalName:   new RegExp(search, 'i') },
          { email:       new RegExp(search, 'i') },
          { phone:       new RegExp(search, 'i') },
          { driverCode:  new RegExp(search, 'i') },
        ];
      }

      const [drivers, total] = await Promise.all([
        Driver.find(filter)
          .populate('user', 'name email phone avatar isOnline')
          .populate('ownerAgency', 'businessName')
          .select('-kyc.aadhaarNumber -bankDetails.accountNumber -adminNotes')
          .sort({ createdAt: -1 })
          .skip((+page - 1) * +limit)
          .limit(+limit),
        Driver.countDocuments(filter),
      ]);

      return res.json({ success: true, total, page: +page, count: drivers.length, data: drivers });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/admin/drivers/:driverId
 * Full driver detail (admin view)
 */
router.get(
  '/admin/drivers/:driverId',
  adminOnly,
  cache(30, (req) => `admin:driver:${req.params.driverId}`),
  async (req, res) => {
    try {
      const driver = await Driver.findById(req.params.driverId)
        .populate('user', 'name email phone avatar isOnline lastseen loginCount lastLoginAt')
        .populate('ownerAgency', 'businessName ownerPhone')
        .populate('assignedVehicleId', 'registrationNumber vehicleType');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
      return res.json({ success: true, data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/drivers/:driverId/kyc
 * Admin verifies / rejects driver KYC
 */
router.patch(
  '/admin/drivers/:driverId/kyc',
  adminOnly,
  async (req, res) => {
    try {
      const { verificationStatus, rejectionReason } = req.body;
      const allowed = ['Pending', 'Under-Review', 'Verified', 'Rejected'];
      if (!allowed.includes(verificationStatus)) {
        return res.status(400).json({ success: false, message: `verificationStatus must be one of: ${allowed.join(', ')}` });
      }

      const driver = await Driver.findById(req.params.driverId);
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      driver.kyc.verificationStatus = verificationStatus;
      driver.kyc.verifiedBy = req.user._id;
      driver.updatedBy = req.user._id;

      if (verificationStatus === 'Verified') {
        driver.kyc.isVerified = true;
        driver.kyc.verifiedAt = new Date();
        driver.isVerified = true;
        driver.isActive = true;
      }
      if (verificationStatus === 'Rejected') {
        driver.kyc.rejectionReason = rejectionReason;
      }

      await driver.save(); // Triggers driver hooks

      await invalidatePattern(`admin:driver:${req.params.driverId}`);
      await invalidatePattern('admin:drivers:list*');

      syslog({
        level: verificationStatus === 'Verified' ? 'success' : 'warning', category: 'kyc',
        message: `Driver KYC ${verificationStatus}: ${driver.legalName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'User', entityId: driver._id, label: driver.legalName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
        metadata: { verificationStatus, rejectionReason },
      });

      return res.json({ success: true, message: `Driver KYC ${verificationStatus}`, data: driver });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/drivers/:driverId/block
 * Admin blocks a driver
 */
router.patch(
  '/admin/drivers/:driverId/block',
  adminOnly,
  async (req, res) => {
    try {
      const { blockReason } = req.body;
      const driver = await Driver.findByIdAndUpdate(
        req.params.driverId,
        { $set: { isBlocked: true, blockReason, status: 'Offline', isActive: false, updatedBy: req.user._id } },
        { new: true }
      ).select('legalName isBlocked');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      syslog({
        level: 'warning', category: 'security',
        message: `Driver BLOCKED: ${driver.legalName}. Reason: ${blockReason}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'User', entityId: driver._id, label: driver.legalName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'Driver blocked', isBlocked: driver.isBlocked });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/drivers/:driverId/unblock
 * Admin unblocks a driver
 */
router.patch(
  '/admin/drivers/:driverId/unblock',
  adminOnly,
  async (req, res) => {
    try {
      const driver = await Driver.findByIdAndUpdate(
        req.params.driverId,
        { $set: { isBlocked: false, blockReason: null, updatedBy: req.user._id } },
        { new: true }
      ).select('legalName isBlocked');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      syslog({
        level: 'info', category: 'security',
        message: `Driver UNBLOCKED: ${driver.legalName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'User', entityId: driver._id, label: driver.legalName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.json({ success: true, message: 'Driver unblocked' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/drivers/:driverId/admin-notes
 * Add internal admin notes to a driver
 */
router.patch(
  '/admin/drivers/:driverId/admin-notes',
  adminOnly,
  async (req, res) => {
    try {
      const driver = await Driver.findByIdAndUpdate(
        req.params.driverId,
        { $set: { adminNotes: req.body.notes, updatedBy: req.user._id } },
        { new: true }
      ).select('legalName adminNotes');

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
      return res.json({ success: true, data: { adminNotes: driver.adminNotes } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/transport/admin/drivers/:driverId/coins
 * Admin credit / debit driver coins
 */
router.post(
  '/admin/drivers/:driverId/coins',
  adminOnly,
  async (req, res) => {
    try {
      const { type, amount, description } = req.body;
      if (!['ADMIN_CREDIT', 'ADMIN_DEBIT'].includes(type)) {
        return res.status(400).json({ success: false, message: 'type must be ADMIN_CREDIT or ADMIN_DEBIT' });
      }

      const driver = await Driver.findById(req.params.driverId);
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      if (type === 'ADMIN_CREDIT') {
        await driver.earnCoins(amount, description || 'Admin credit');
      } else {
        await driver.redeemCoins(amount, description || 'Admin debit');
      }

      return res.json({ success: true, message: `${type}: ${amount} coins`, coinBalance: driver.rewards.coinBalance });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/admin/drivers/available
 * Find nearest available drivers (for admin dispatch)
 */
router.get(
  '/admin/drivers/available',
  adminOnly,
  async (req, res) => {
    try {
      const { lng, lat, radius = 10000, agencyId } = req.query;
      if (!lng || !lat) return res.status(400).json({ success: false, message: 'lng and lat are required' });

      const drivers = await Driver.findNearestAvailable(+lng, +lat, +radius, agencyId);
      return res.json({ success: true, count: drivers.length, data: drivers });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §L  ADMIN / SUPERADMIN — PLATFORM FEE OVERRIDES & PRICING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/admin/pricing/global
 * Get global transport pricing config
 */
router.get(
  '/admin/pricing/global',
  adminOnly,
  cache(120, () => 'admin:pricing:global'),
  async (req, res) => {
    try {
      const config = await PlatformPricingConfig.getGlobal();
      return res.json({ success: true, data: config.transport });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/pricing/global
 * Superadmin updates global transport pricing
 */
router.patch(
  '/admin/pricing/global',
  superOnly,
  async (req, res) => {
    try {
      const config = await PlatformPricingConfig.getGlobal();
      const { note, ...transportUpdates } = req.body;

      Object.keys(transportUpdates).forEach((k) => {
        config.transport[k] = transportUpdates[k];
      });

      await config.saveWithAudit(req.user._id, req.user.role, note || 'Transport pricing updated');

      await invalidateKey('admin:pricing:global');
      await invalidatePattern('GET:/api/transport/pricing*');

      syslog({
        level: 'success', category: 'system',
        message: `Global transport pricing updated by ${req.user.name}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
        metadata: { updatedFields: Object.keys(transportUpdates) },
      });

      return res.json({ success: true, message: 'Global pricing updated', data: config.transport });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/partners/:partnerId/platform-fee
 * Set or clear platform fee override for one partner
 */
router.patch(
  '/admin/partners/:partnerId/platform-fee',
  adminOnly,
  async (req, res) => {
    try {
      const { type, value, clear } = req.body;

      const update = clear
        ? { $set: { platformFeeOverride: null, updatedBy: req.user._id } }
        : { $set: { platformFeeOverride: { type, value }, updatedBy: req.user._id } };

      const partner = await TransportPartner.findByIdAndUpdate(
        req.params.partnerId, update, { new: true, runValidators: true }
      ).select('businessName platformFeeOverride');

      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

      await invalidateTPCache(partner._id);

      syslog({
        level: 'info', category: 'system',
        message: `Platform fee override ${clear ? 'cleared' : 'set'} for ${partner.businessName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: partner._id, label: partner.businessName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
        metadata: clear ? { cleared: true } : { type, value },
      });

      return res.json({ success: true, message: `Platform fee override ${clear ? 'cleared' : 'applied'}`, data: partner.platformFeeOverride });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/transport/admin/partners/:partnerId/settlement
 * Process a settlement for a partner (admin marks as settled)
 */
router.patch(
  '/admin/partners/:partnerId/settlement',
  adminOnly,
  async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'A positive amount is required' });

      const partner = await TransportPartner.findById(req.params.partnerId).select('bankDetails.pendingSettlementAmount bankDetails.totalSettledAmount businessName');
      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

      if (amount > partner.bankDetails.pendingSettlementAmount) {
        return res.status(400).json({ success: false, message: 'Amount exceeds pending settlement balance' });
      }

      await TransportPartner.findByIdAndUpdate(req.params.partnerId, {
        $inc: {
          'bankDetails.pendingSettlementAmount': -amount,
          'bankDetails.totalSettledAmount':       amount,
        },
        $set: { 'bankDetails.lastSettledAt': new Date(), updatedBy: req.user._id },
      });

      await invalidateTPCache(partner._id);

      syslog({
        level: 'success', category: 'payment',
        message: `Settlement of ₹${amount} processed for ${partner.businessName}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.deviceInfo?.ipAddress },
        relatedEntity: { model: 'TransportPartner', entityId: partner._id, label: partner.businessName },
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
        metadata: { amount },
      });

      return res.json({ success: true, message: `₹${amount} settlement processed` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §M  ADMIN — SYSTEM LOGS FOR PARTNER / DRIVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/transport/admin/logs
 * All transport-related system logs (admin view)
 */
router.get(
  '/admin/logs',
  adminOnly,
  async (req, res) => {
    try {
      const {
        page = 1, limit = 20, level, category,
        userId, entityId, search,
      } = req.query;

      const filter = {};
      if (level)    filter.level    = level;
      if (category) filter.category = category;
      if (userId)   filter['actor.userId'] = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
      if (entityId) filter['relatedEntity.entityId'] = mongoose.Types.ObjectId.isValid(entityId) ? new mongoose.Types.ObjectId(entityId) : null;
      if (search)   filter.$text   = { $search: search };

      const [logs, total] = await Promise.all([
        SystemLog.find(filter)
          .sort({ createdAt: -1 })
          .skip((+page - 1) * +limit)
          .limit(+limit)
          .select('-sensitivePayload'),
        SystemLog.countDocuments(filter),
      ]);

      return res.json({ success: true, total, page: +page, count: logs.length, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/admin/partners/:partnerId/logs
 * System logs specifically for one transport partner
 */
router.get(
  '/admin/partners/:partnerId/logs',
  adminOnly,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, level, category } = req.query;

      const partner = await TransportPartner.findById(req.params.partnerId).select('user businessName');
      if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

      const filter = {
        $or: [
          { 'actor.userId': partner.user },
          { 'relatedEntity.entityId': partner._id },
        ],
      };
      if (level)    filter.level    = level;
      if (category) filter.category = category;

      const [logs, total] = await Promise.all([
        SystemLog.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit).select('-sensitivePayload'),
        SystemLog.countDocuments(filter),
      ]);

      return res.json({ success: true, partnerName: partner.businessName, total, page: +page, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/admin/drivers/:driverId/logs
 * System logs for one driver (admin view)
 */
router.get(
  '/admin/drivers/:driverId/logs',
  adminOnly,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, level, category } = req.query;

      const driver = await Driver.findById(req.params.driverId).select('user legalName');
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      const filter = {
        $or: [
          { 'actor.userId':         driver.user },
          { 'relatedEntity.entityId': driver._id },
        ],
      };
      if (level)    filter.level    = level;
      if (category) filter.category = category;

      const [logs, total] = await Promise.all([
        SystemLog.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit).select('-sensitivePayload'),
        SystemLog.countDocuments(filter),
      ]);

      return res.json({ success: true, driverName: driver.legalName, total, page: +page, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/transport/admin/stats
 * Platform-wide transport stats for admin dashboard
 */
router.get(
  '/admin/stats',
  adminOnly,
  cache(300, () => 'admin:transport:stats'),
  async (req, res) => {
    try {
      const [partnerStats, driverStats, vehicleStats] = await Promise.all([
        TransportPartner.aggregate([
          { $group: {
              _id: '$partnershipStatus',
              count: { $sum: 1 },
              totalVehicles: { $sum: '$fleetInfo.totalVehicles' }, // Fixed to use cache
              totalRides:    { $sum: '$stats.totalRidesCompleted' },
              totalEarnings: { $sum: '$stats.totalEarnings' },
            }
          },
        ]),
        Driver.aggregate([
          { $group: {
              _id: '$status',
              count: { $sum: 1 },
            }
          },
        ]),
        Vehicle.aggregate([
          { $group: {
              _id: '$verificationStatus',
              count: { $sum: 1 },
              byType: { $push: '$vehicleType' },
            }
          },
        ]),
      ]);

      return res.json({ success: true, data: { partnerStats, driverStats, vehicleStats } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;