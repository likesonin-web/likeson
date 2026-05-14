/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BLOOD BANK ROUTER — Likeson.in  (FIXED)
 *
 * FIXES APPLIED:
 *   FIX 1: Route order — /request/verify-payment BEFORE /:id to avoid param collision
 *   FIX 2: BloodRequest model imported and used properly for DB persistence
 *   FIX 3: Prescription upload multer added to POST /:id/request
 *   FIX 4: addUnit now sets isReleaseApproved=false, status='available' correctly
 *          Unit counter only bumps when isReleaseApproved=true
 *   FIX 5: GET /me/inventory/:invId added (with units array)
 *   FIX 6: Unit update counter logic corrected for isReleaseApproved transition
 *   FIX 7: searchAndAllocate called from BloodRequest static after payment verify
 *   FIX 8: Prescription ImageKit upload endpoint added for customers
 *   FIX 9: booking field removed entirely
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express        from 'express';
import multer         from 'multer';
import crypto         from 'crypto';
import Razorpay       from 'razorpay';
import ImageKit       from 'imagekit';

import dotenv         from 'dotenv';
import sendEmail      from '../utils/sendEmail.js';
import { buildBloodRequestEmail, buildBloodIssuedEmail } from '../utils/emailTemplates.js';
import BloodBank      from '../models/BloodBank.js';
import BloodInventory from '../models/BloodInventory.js';
import BloodRequest   from '../models/BloodRequest.js';
import Hospital       from '../models/Hospital.js';
import User           from '../models/User.js';
import Notification   from '../models/Notification.js';
import SystemLog      from '../models/SystemLog.js';

import { protect, authorize } from '../middleware/authMiddleware.js';

dotenv.config();

// ── Razorpay ──────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || 'rzp_test_SV43jVcrs5wKAM',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'sRxoYVIpHbyLsKXGor6dkHxt',
});

// ── ImageKit ──────────────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY   || 'public_rIdrz0GPllpCv0Q3HzChmkN+sLg=',
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY  || 'private_VZy2yDP9AuEzZRr8BYHhSFWJA/c=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/zxxzgk3iq',
});

// ── Multer (memory) ───────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
});

const prescriptionUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, PDF allowed for prescription'));
  },
});

// ── Router ────────────────────────────────────────────────────────────────────
const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const uploadToImageKit = (buffer, fileName, folder) =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      { file: buffer, fileName, folder: `/likeson/${folder}` },
      (err, result) => (err ? reject(err) : resolve(result.url))
    );
  });

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body     = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'sRxoYVIpHbyLsKXGor6dkHxt')
    .update(body)
    .digest('hex');
  return expected === signature;
};


// ═══════════════════════════════════════════════════════════════════════════════
// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /blood-banks
 */
router.get('/', async (req, res) => {
  try {
    const {
      city, bankType, bloodGroup, component,
      emergency, featured,
      page  = 1,
      limit = 20,
    } = req.query;

    const filter = { isActive: true, status: 'active' };
    if (city)       filter['address.city']     = new RegExp(city, 'i');
    if (bankType)   filter.bankType             = bankType;
    if (bloodGroup) filter.bloodGroupsAvailable = bloodGroup;
    if (component)  filter.componentsHandled    = component;
    if (emergency === 'true') filter.isEmergency24x7 = true;
    if (featured  === 'true') filter.isFeatured       = true;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await BloodBank.countDocuments(filter);
    const banks = await BloodBank.find(filter)
      .select('-statusLog -internalNotes -licenses -accreditations')
      .sort({ isFeatured: -1, 'rating.averageRating': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/nearby
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lng, lat, radius = 20, bloodGroup, component, unitsNeeded = 1 } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'lng and lat required' });
    }

    if (bloodGroup && component) {
      const results = await BloodInventory.findAvailableNearby({
        bloodGroup,
        component,
        unitsNeeded:       parseInt(unitsNeeded),
        lng:               parseFloat(lng),
        lat:               parseFloat(lat),
        maxDistanceMeters: parseFloat(radius) * 1000,
      });
      return res.json({ success: true, data: results });
    }

    const banks = await BloodBank.find({
      isActive: true,
      status:   'active',
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radius) * 1000,
        },
      },
    })
      .select('name bankCode bankType contact address location rating isEmergency24x7 offersDelivery deliveryRadiusKm componentsHandled bloodGroupsAvailable')
      .limit(15)
      .lean();

    res.json({ success: true, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/slug/:slug
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ slug: req.params.slug, isActive: true })
      .populate('inventory')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: All /me/*, /linked, /admin/*, /request/* routes MUST come BEFORE
// /:id to prevent Express from matching those path segments as the :id param.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /blood-banks/linked  (HOSPITAL)
 */
router.get('/linked', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const banks = await BloodBank.find({
      $or: [{ hospital: hospital._id }, { linkedHospitals: hospital._id }],
    })
      .select('name bankCode bankType status isActive contact address location rating componentsHandled bloodGroupsAvailable')
      .lean();

    res.json({ success: true, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/me  (BLOOD_BANK MANAGER)
 */
router.get('/me', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id })
      .populate('inventory')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank profile not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/me/inventory  (BLOOD_BANK MANAGER)
 * Summary only — no units array
 */
router.get('/me/inventory', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id }).lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inventory = await BloodInventory.find({ bloodBank: bank._id })
      .select('-units')
      .lean();

    res.json({ success: true, data: inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/me/inventory/:invId  (BLOOD_BANK MANAGER)
 * Full inventory doc WITH units array.
 */
router.get('/me/inventory/:invId', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id }).lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    res.json({ success: true, data: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/me/requests  (BLOOD_BANK MANAGER)
 */
router.get('/me/requests', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id }).lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { status, page = 1, limit = 20 } = req.query;
    const filter = { 'allocations.bloodBank': bank._id };
    if (status) filter.status = status;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await BloodRequest.countDocuments(filter);
    const requests = await BloodRequest.find(filter)
      .populate('requestedBy', 'name email phone')
      .populate('hospital', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/me/stats  (BLOOD_BANK MANAGER)
 */
router.get('/me/stats', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id })
      .select('stats rating bankCode name')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const invSummary = await BloodInventory.aggregate([
      { $match: { bloodBank: bank._id } },
      { $group: {
        _id:            null,
        totalAvailable: { $sum: '$availableUnits' },
        totalReserved:  { $sum: '$reservedUnits' },
        totalIssued:    { $sum: '$issuedUnits' },
        totalExpired:   { $sum: '$expiredUnits' },
        lowStockCount:  { $sum: { $cond: ['$isLowStock',      1, 0] } },
        criticalCount:  { $sum: { $cond: ['$isCriticalStock', 1, 0] } },
      }},
    ]);

    res.json({
      success: true,
      data: { bank: { name: bank.name, bankCode: bank.bankCode, rating: bank.rating }, stats: bank.stats, inventory: invSummary[0] || {} },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/me/status-log  (BLOOD_BANK MANAGER)
 */
router.get('/me/status-log', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id })
      .select('statusLog name')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank.statusLog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ADMIN routes ──────────────────────────────────────────────────────────────

router.get('/admin/all', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, bankType, page = 1, limit = 30, search } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (bankType) filter.bankType = bankType;
    if (search)   filter.$or = [
      { name:     new RegExp(search, 'i') },
      { bankCode: new RegExp(search, 'i') },
    ];

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await BloodBank.countDocuments(filter);
    const banks = await BloodBank.find(filter)
      .select('+internalNotes')
      .populate('managedBy', 'name email phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, total, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id)
      .select('+internalNotes +bankDetails.accountNumber')
      .populate('managedBy', 'name email phone role')
      .populate('hospital',  'name address')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/:id/stats', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id).select('stats rating name bankCode').lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const invSummary = await BloodInventory.aggregate([
      { $match: { bloodBank: bank._id } },
      { $group: {
        _id:            null,
        totalAvailable: { $sum: '$availableUnits' },
        totalReserved:  { $sum: '$reservedUnits' },
        totalIssued:    { $sum: '$issuedUnits' },
        totalExpired:   { $sum: '$expiredUnits' },
        slots:          { $sum: 1 },
      }},
    ]);

    res.json({ success: true, data: { bank, inventory: invSummary[0] || {} } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, reason } = req.body;
    const valid = ['pending', 'under_review', 'active', 'suspended', 'revoked', 'deactivated'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be: ${valid.join(', ')}` });
    }

    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const prevStatus     = bank.status;
    bank.status          = status;
    bank.updatedBy       = req.user._id;
    if (status === 'suspended') bank.suspensionReason = reason || 'Administrative action';
    if (status === 'revoked')   bank.rejectionReason  = reason || 'License revoked';
    await bank.save();

    const manager = await User.findById(bank.managedBy).select('email name');
    if (manager?.email) {
      await sendEmail({
        email:   manager.email,
        subject: `Blood Bank Status Update — ${bank.name}`,
        html:    `<p>Hi ${manager.name},</p><p>Your blood bank <strong>${bank.name}</strong> status changed from <strong>${prevStatus}</strong> to <strong>${status}</strong>. ${reason ? `Reason: ${reason}` : ''}</p>`,
      }).catch(console.error);
    }

    await SystemLog.createLog({
      level: 'info', category: 'system',
      message: `Blood bank status changed: ${prevStatus} → ${status}`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { prevStatus, newStatus: status, reason },
    });

    res.json({ success: true, message: `Status updated to ${status}`, data: { status: bank.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/:id/verify', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    bank.isVerified = true;
    bank.verifiedAt = new Date();
    bank.verifiedBy = req.user._id;
    bank.status     = 'active';
    bank.updatedBy  = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'Blood bank verified and activated', data: { isVerified: true, status: bank.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/:id/featured', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    bank.isFeatured = !bank.isFeatured;
    bank.updatedBy  = req.user._id;
    await bank.save();
    res.json({ success: true, message: `Featured set to ${bank.isFeatured}`, data: { isFeatured: bank.isFeatured } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/:id/licenses/:licId/verify', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const lic = bank.licenses.id(req.params.licId);
    if (!lic) return res.status(404).json({ success: false, message: 'License not found' });

    lic.isVerified = true;
    lic.verifiedBy = req.user._id;
    lic.verifiedAt = new Date();
    bank.updatedBy = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'License verified', data: lic });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    await BloodInventory.deleteMany({ bloodBank: req.params.id });

    await SystemLog.createLog({
      level: 'warning', category: 'system',
      message: `Blood bank hard-deleted: ${bank.name} (${bank.bankCode})`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      metadata: { bankCode: bank.bankCode, bankName: bank.name },
    });

    res.json({ success: true, message: 'Blood bank deleted permanently' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// FIX 1: /request/* routes BEFORE /:id param routes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /blood-banks/prescription/upload  (CUSTOMER)
 */
router.post(
  '/prescription/upload',
  protect,
  authorize('customer'),
  prescriptionUpload.single('prescription'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded. Field name must be "prescription".' });
      }

      const url = await uploadToImageKit(
        req.file.buffer,
        `rx_${req.user._id}_${Date.now()}`,
        'blood-requests/prescriptions'
      );

      res.json({
        success: true,
        message: 'Prescription uploaded. Use prescriptionUrl in your blood request.',
        data:    { prescriptionUrl: url },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /blood-banks/request/verify-payment  (CUSTOMER)
 * FIX 9: booking field removed from BloodRequest.create()
 *
 * Body: {
 *   razorpayOrderId, razorpayPaymentId, razorpaySignature,
 *   bloodBankId, bloodGroup, component, unitsNeeded,
 *   patientName, patientAge, patientGender,
 *   hospitalId, urgency, clinicalIndication, notes,
 *   prescriptionUrl,
 * }
 */
router.post('/request/verify-payment', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      razorpayOrderId, razorpayPaymentId, razorpaySignature,
      bloodBankId, bloodGroup, component, unitsNeeded = 1,
      patientName, patientAge, patientGender,
      hospitalId, urgency = 'routine', clinicalIndication, notes,
      prescriptionUrl,
    } = req.body;

    const valid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    const bank = await BloodBank.findById(bloodBankId);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const resolvedHospitalId = hospitalId || bank.hospital || null;

    const isEmergencyRequest = ['emergency', 'mass_casualty'].includes(urgency);
    if (!isEmergencyRequest && !prescriptionUrl) {
      return res.status(400).json({
        success:  false,
        message:  'prescriptionUrl required for non-emergency blood requests. Upload via POST /blood-banks/prescription/upload first.',
      });
    }

    const inv = await BloodInventory.findOne({
      bloodBank:      bloodBankId,
      bloodGroup,
      component,
      availableUnits: { $gte: parseInt(unitsNeeded) },
    });
    if (!inv) {
      return res.status(400).json({
        success: false,
        message: 'Stock no longer available. Payment will be refunded.',
      });
    }

    // FIX 9: No booking field
    const bloodRequest = await BloodRequest.create({
      requestType: 'patient_direct',
      requestedBy: req.user._id,
      hospital:    resolvedHospitalId,
      patient: {
        name:   patientName || req.user.name,
        age:    patientAge,
        gender: patientGender,
        bloodGroup,
      },
      bloodGroup,
      component,
      unitsRequired:    parseInt(unitsNeeded),
      urgency,
      clinicalIndication,
      clinicalNotes:    notes,
      crossMatchRequired: true,
      prescriptionUrl:  prescriptionUrl || null,
      prescriptionWaived: isEmergencyRequest,
      prescriptionWaivedReason: isEmergencyRequest ? `Auto-waived: urgency=${urgency}` : null,
      status:        'searching',
      paymentStatus: 'paid',
      fareBreakdown: {
        processingFees: 0,
        crossMatchFees: 0,
        deliveryFees:   0,
        platformFee:    0,
        taxes:          0,
        discount:       0,
        totalAmount:    0,
        currency:       'INR',
      },
      createdBy: req.user._id,
    });

    let allocationResult = null;
    try {
      allocationResult = await BloodRequest.searchAndAllocate(bloodRequest._id);
    } catch (allocErr) {
      console.error('searchAndAllocate failed after payment:', allocErr.message);
    }

    const manager = await User.findById(bank.managedBy).select('_id email name');
    if (manager) {
      await Notification.create({
        recipient: manager._id,
        title:     `New Blood Request — ${bloodGroup} ${component}`,
        body:      `${unitsNeeded} unit(s) of ${bloodGroup} ${component} requested. Ref: ${bloodRequest.requestCode}`,
        type:      'Order_Placed',
        priority:  'High',
        deepLink:  { screen: 'BloodRequests', referenceId: bank._id },
      });

      if (manager.email) {
        await sendEmail({
          email:   manager.email,
          subject: `New Blood Request — ${bloodGroup} ${component} | ${bloodRequest.requestCode}`,
          html:    buildBloodRequestEmail({
            userName:      manager.name,
            requestId:     bloodRequest.requestCode,
            bloodGroup,
            component,
            units:         unitsNeeded,
            bankName:      bank.name,
            processingFee: 'Processing fee collected via platform',
          }),
        }).catch(console.error);
      }
    }

    await sendEmail({
      email:   req.user.email,
      subject: `Blood Request Confirmed — ${bloodGroup} ${component} | ${bloodRequest.requestCode}`,
      html:    buildBloodRequestEmail({
        userName:      req.user.name,
        requestId:     bloodRequest.requestCode,
        bloodGroup,
        component,
        units:         unitsNeeded,
        bankName:      bank.name,
        processingFee: 'Already paid',
      }),
    }).catch(console.error);

    await SystemLog.createLog({
      level: 'success', category: 'payment',
      message: `Blood request payment verified: ${bloodRequest.requestCode}`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { requestCode: bloodRequest.requestCode, bloodGroup, component, unitsNeeded, razorpayOrderId, razorpayPaymentId },
    });

    res.json({
      success: true,
      message: 'Payment verified. Blood request created. Bank notified.',
      data: {
        requestCode:    bloodRequest.requestCode,
        requestId:      bloodRequest._id,
        bloodGroup,
        component,
        unitsNeeded:    parseInt(unitsNeeded),
        bankName:       bank.name,
        status:         bloodRequest.status,
        allocation:     allocationResult,
        prescriptionRequired: !isEmergencyRequest,
        prescriptionUrl:      prescriptionUrl || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// ── /:id PARAM ROUTES — must come AFTER all /me, /admin, /request routes ──────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /blood-banks/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true })
      .select('-internalNotes -statusLog')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/:id/inventory  (public summary)
 */
router.get('/:id/inventory', async (req, res) => {
  try {
    const inventory = await BloodInventory.find({ bloodBank: req.params.id })
      .select('-units -createdBy -updatedBy')
      .lean();
    res.json({ success: true, data: inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/:id/inventory/search
 */
router.get('/:id/inventory/search', async (req, res) => {
  try {
    const { bloodGroup, component, unitsNeeded = 1 } = req.query;
    const filter = { bloodBank: req.params.id };
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (component)  filter.component  = component;
    if (parseInt(unitsNeeded) > 0) filter.availableUnits = { $gte: parseInt(unitsNeeded) };

    const results = await BloodInventory.find(filter).select('-units').lean();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/:id/reviews
 */
router.get('/:id/reviews', async (_req, res) => {
  res.status(501).json({ success: false, message: 'Review model not yet implemented.' });
});

/**
 * POST /blood-banks/:id/reviews  (CUSTOMER)
 */
router.post('/:id/reviews', protect, authorize('customer'), async (_req, res) => {
  res.status(501).json({ success: false, message: 'Review model not yet implemented.' });
});

/**
 * POST /blood-banks/:id/request  (CUSTOMER)
 * Multipart field: prescription (optional — or supply prescriptionUrl in body)
 */
router.post(
  '/:id/request',
  protect,
  authorize('customer'),
  prescriptionUpload.single('prescription'),
  async (req, res) => {
    try {
      const {
        bloodGroup, component, unitsNeeded = 1,
        patientName, patientAge, patientGender,
        hospitalId, urgency = 'routine', clinicalIndication, notes,
      } = req.body;

      let { prescriptionUrl } = req.body;

      if (!bloodGroup || !component) {
        return res.status(400).json({ success: false, message: 'bloodGroup and component required' });
      }

      if (req.file && !prescriptionUrl) {
        prescriptionUrl = await uploadToImageKit(
          req.file.buffer,
          `rx_${req.user._id}_${Date.now()}`,
          'blood-requests/prescriptions'
        );
      }

      const isEmergencyRequest = ['emergency', 'mass_casualty'].includes(urgency);
      if (!isEmergencyRequest && !prescriptionUrl) {
        return res.status(400).json({
          success:  false,
          message:  'prescriptionUrl required. Either upload file as multipart field "prescription" or use POST /blood-banks/prescription/upload first.',
        });
      }

      const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true, status: 'active' });
      if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found or inactive' });

      const inv = await BloodInventory.findOne({
        bloodBank:      bank._id,
        bloodGroup,
        component,
        availableUnits: { $gte: parseInt(unitsNeeded) },
      });
      if (!inv) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Requested ${unitsNeeded} unit(s) of ${bloodGroup} ${component} — not available.`,
        });
      }

      const pricingEntry  = bank.pricing?.find(p => p.component === component);
      const feePerUnit    = pricingEntry?.processingFee || inv.processingFeePerUnit || 0;
      const crossMatchFee = pricingEntry?.crossMatchFee || inv.crossMatchFeePerUnit || 0;
      const totalFee      = (feePerUnit + crossMatchFee) * parseInt(unitsNeeded);

      const rzpOrder = await razorpay.orders.create({
        amount:   Math.max(100, Math.round(totalFee * 100)),
        currency: 'INR',
        receipt:  `bb_req_${Date.now()}`,
        notes: {
          bloodBankId:     bank._id.toString(),
          bloodGroup,
          component,
          unitsNeeded:     unitsNeeded.toString(),
          customerId:      req.user._id.toString(),
          patientName:     patientName || req.user.name,
          prescriptionUrl: prescriptionUrl || '',
          urgency,
        },
      });

      res.json({
        success: true,
        message: 'Razorpay order created. Complete payment to confirm blood request.',
        data: {
          razorpayOrderId:  rzpOrder.id,
          amount:           totalFee,
          currency:         'INR',
          bankName:         bank.name,
          bloodGroup,
          component,
          unitsNeeded:      parseInt(unitsNeeded),
          urgency,
          prescriptionUrl:  prescriptionUrl || null,
          prescriptionRequired: !isEmergencyRequest,
          feeBreakdown: {
            processingFee: feePerUnit * parseInt(unitsNeeded),
            crossMatchFee: crossMatchFee * parseInt(unitsNeeded),
            total:         totalFee,
          },
          razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_SV43jVcrs5wKAM',
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /blood-banks/:id/link  (HOSPITAL)
 */
router.post('/:id/link', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    await BloodBank.findByIdAndUpdate(bank._id, { $addToSet: { linkedHospitals: hospital._id } });
    await Hospital.findByIdAndUpdate(hospital._id, { $addToSet: { bloodBanks: bank._id } });

    res.json({ success: true, message: `Supply agreement established with ${bank.name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /blood-banks/:id/link  (HOSPITAL)
 */
router.delete('/:id/link', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    await BloodBank.findByIdAndUpdate(req.params.id, { $pull: { linkedHospitals: hospital._id } });
    await Hospital.findByIdAndUpdate(hospital._id,   { $pull: { bloodBanks: req.params.id } });

    res.json({ success: true, message: 'Supply agreement removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// ── BLOOD_BANK MANAGER WRITE ROUTES ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /blood-banks  (BLOOD_BANK MANAGER)
 */
router.post('/', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const existing = await BloodBank.findOne({ managedBy: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Blood bank profile already exists for this account.' });
    }

    const { bankType, hospital: hospitalId, parentBank } = req.body;

    if (bankType === 'hospital_embedded' && !hospitalId) {
      return res.status(400).json({ success: false, message: 'hospital field required for hospital_embedded type' });
    }
    if (bankType === 'mobile_unit' && !parentBank) {
      return res.status(400).json({ success: false, message: 'parentBank field required for mobile_unit type' });
    }

    const bank = await BloodBank.create({
      ...req.body,
      managedBy: req.user._id,
      createdBy: req.user._id,
      status:    'pending',
    });

    if (bankType === 'hospital_embedded' && hospitalId) {
      await Hospital.findByIdAndUpdate(hospitalId, {
        $addToSet: { bloodBanks: bank._id },
        $set:      { primaryBloodBank: bank._id },
      });
    }

    await SystemLog.createLog({
      level: 'success', category: 'system',
      message: `Blood bank created: ${bank.name} (${bank.bankCode})`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
    });

    res.status(201).json({ success: true, message: 'Blood bank created. Awaiting admin verification.', data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me  (BLOOD_BANK MANAGER)
 */
router.put('/me', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const allowed = [
      'name', 'description', 'contact', 'address', 'operatingHours',
      'componentsHandled', 'bloodGroupsAvailable', 'googleMapsUrl',
      'acceptsDonations', 'offersDelivery', 'offersCrossMatch',
      'offersComponentSeparation', 'offersEmergencySupply', 'isEmergency24x7',
      'hasApheresisFacility', 'hasMobileUnit',
      'deliveryRadiusKm', 'deliveryFeePerKm', 'freeDeliveryKm',
      'contactPersons', 'tags',
    ];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) bank[field] = req.body[field];
    });

    bank.updatedBy = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'Profile updated', data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/logo  (BLOOD_BANK MANAGER)
 */
router.put('/me/logo', protect, authorize('blood_bank'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const url = await uploadToImageKit(req.file.buffer, `logo_${bank.bankCode}_${Date.now()}`, 'blood-banks/logos');
    bank.logoUrl   = url;
    bank.updatedBy = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'Logo uploaded', data: { logoUrl: url } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/licenses  (BLOOD_BANK MANAGER)
 */
router.put('/me/licenses', protect, authorize('blood_bank'), upload.single('document'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { licenseId, licenseType, licenseNumber, issuedBy, issuedOn, validUntil } = req.body;

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(req.file.buffer, `lic_${bank.bankCode}_${Date.now()}`, 'blood-banks/licenses');
    }

    if (licenseId) {
      const lic = bank.licenses.id(licenseId);
      if (!lic) return res.status(404).json({ success: false, message: 'License not found' });
      if (licenseType)   lic.licenseType   = licenseType;
      if (licenseNumber) lic.licenseNumber  = licenseNumber;
      if (issuedBy)      lic.issuedBy       = issuedBy;
      if (issuedOn)      lic.issuedOn       = new Date(issuedOn);
      if (validUntil)    lic.validUntil     = new Date(validUntil);
      if (documentUrl)   lic.documentUrl    = documentUrl;
      lic.isVerified = false;
    } else {
      if (!licenseType || !licenseNumber) {
        return res.status(400).json({ success: false, message: 'licenseType and licenseNumber required' });
      }
      bank.licenses.push({ licenseType, licenseNumber, issuedBy, issuedOn, validUntil, documentUrl });
    }

    bank.updatedBy = req.user._id;
    await bank.save();
    res.json({ success: true, message: licenseId ? 'License updated' : 'License added', data: bank.licenses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/accreditations  (BLOOD_BANK MANAGER)
 */
router.put('/me/accreditations', protect, authorize('blood_bank'), upload.single('document'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { accreditationId, body: accBody, certificateNo, issuedOn, validUntil } = req.body;

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(req.file.buffer, `acc_${bank.bankCode}_${Date.now()}`, 'blood-banks/accreditations');
    }

    if (accreditationId) {
      const acc = bank.accreditations.id(accreditationId);
      if (!acc) return res.status(404).json({ success: false, message: 'Accreditation not found' });
      if (accBody)       acc.body          = accBody;
      if (certificateNo) acc.certificateNo = certificateNo;
      if (issuedOn)      acc.issuedOn      = new Date(issuedOn);
      if (validUntil)    acc.validUntil    = new Date(validUntil);
      if (documentUrl)   acc.documentUrl   = documentUrl;
      acc.isVerified = false;
    } else {
      if (!accBody) return res.status(400).json({ success: false, message: 'body (accreditation body) required' });
      bank.accreditations.push({ body: accBody, certificateNo, issuedOn, validUntil, documentUrl });
    }

    bank.updatedBy = req.user._id;
    await bank.save();
    res.json({ success: true, message: accreditationId ? 'Accreditation updated' : 'Accreditation added', data: bank.accreditations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/bank-details  (BLOOD_BANK MANAGER)
 */
router.put('/me/bank-details', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body;

    const setFields = { 'bankDetails.isVerified': false, updatedBy: req.user._id };
    if (accountHolderName !== undefined) setFields['bankDetails.accountHolderName'] = accountHolderName;
    if (ifscCode          !== undefined) setFields['bankDetails.ifscCode']          = ifscCode;
    if (bankName          !== undefined) setFields['bankDetails.bankName']           = bankName;
    if (upiId             !== undefined) setFields['bankDetails.upiId']              = upiId;

    if (accountNumber !== undefined) {
      setFields['bankDetails.accountNumber'] = accountNumber;
      setFields['bankDetails.accountLast4']  = accountNumber.slice(-4);
    }

    const updated = await BloodBank.findOneAndUpdate(
      { managedBy: req.user._id },
      { $set: setFields },
      { new: true, select: 'bankDetails.accountLast4 bankDetails.bankName bankDetails.upiId bankDetails.isVerified' }
    );

    res.json({
      success: true,
      message: 'Bank details updated. Admin verification required.',
      data: {
        accountLast4: updated.bankDetails.accountLast4,
        bankName:     updated.bankDetails.bankName,
        upiId:        updated.bankDetails.upiId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/stock-alerts  (BLOOD_BANK MANAGER)
 */
router.put('/me/stock-alerts', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    if (!Array.isArray(req.body.stockAlerts)) {
      return res.status(400).json({ success: false, message: 'stockAlerts must be an array' });
    }

    bank.stockAlerts = req.body.stockAlerts;
    bank.updatedBy   = req.user._id;
    await bank.save();
    res.json({ success: true, message: 'Stock alert thresholds updated', data: bank.stockAlerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/pricing  (BLOOD_BANK MANAGER)
 */
router.put('/me/pricing', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    if (!Array.isArray(req.body.pricing)) {
      return res.status(400).json({ success: false, message: 'pricing must be an array' });
    }

    bank.pricing   = req.body.pricing;
    bank.updatedBy = req.user._id;
    await bank.save();

    for (const entry of req.body.pricing) {
      await BloodInventory.updateMany(
        { bloodBank: bank._id, component: entry.component },
        { $set: { processingFeePerUnit: entry.processingFee || 0, crossMatchFeePerUnit: entry.crossMatchFee || 0 } }
      );
    }

    res.json({ success: true, message: 'Pricing updated', data: bank.pricing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /blood-banks/me/inventory  (BLOOD_BANK MANAGER)
 */
router.post('/me/inventory', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { bloodGroup, component, processingFeePerUnit = 0, crossMatchFeePerUnit = 0 } = req.body;
    if (!bloodGroup || !component) {
      return res.status(400).json({ success: false, message: 'bloodGroup and component required' });
    }

    const existing = await BloodInventory.findOne({ bloodBank: bank._id, bloodGroup, component });
    if (existing) {
      return res.status(400).json({ success: false, message: `Inventory slot for ${bloodGroup} ${component} already exists` });
    }

    const inv = await BloodInventory.create({
      bloodBank:   bank._id,
      bloodGroup,
      component,
      location:    bank.location,
      cityName:    bank.address?.city,
      processingFeePerUnit,
      crossMatchFeePerUnit,
      createdBy:   req.user._id,
    });

    res.status(201).json({ success: true, message: 'Inventory slot created', data: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /blood-banks/me/inventory/:invId/units  (BLOOD_BANK MANAGER)
 */
router.post('/me/inventory/:invId/units', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    const {
      bagNumber, collectedAt, volumeMl,
      donorCode, donorName, collectedByStaff,
      expiresAt, storageLocation, storageSlot,
    } = req.body;

    if (!bagNumber || !collectedAt || !volumeMl) {
      return res.status(400).json({ success: false, message: 'bagNumber, collectedAt, volumeMl required' });
    }

    const bagExists = inv.units.some(u => u.bagNumber === bagNumber.toUpperCase());
    if (bagExists) {
      return res.status(400).json({ success: false, message: `Bag number ${bagNumber} already exists` });
    }

    let finalExpiry = expiresAt;
    if (!finalExpiry) {
      const shelfLifeConfig = await BloodInventory.findOne().select('COMPONENT_SHELF_LIFE_DAYS').lean();
      const days = shelfLifeConfig?.COMPONENT_SHELF_LIFE_DAYS?.[inv.component] ?? 35;
      const d = new Date(collectedAt);
      d.setDate(d.getDate() + days);
      finalExpiry = d;
    }

    const updatedInv = await BloodInventory.addUnit(inv._id, {
      bagNumber: bagNumber.toUpperCase(),
      collectedAt,
      volumeMl: parseFloat(volumeMl),
      donorCode: donorCode || 'WALK-IN',
      donorName,
      collectedByStaff,
      expiresAt: finalExpiry,
      storageLocation,
      storageSlot,
      status: 'available',
      isReleaseApproved: false,
      isTestingComplete: false,
      testResults: {
        hiv: 'Pending', hbsAg: 'Pending', hcv: 'Pending',
        syphilis: 'Pending', malaria: 'Pending', allClear: false,
      },
    });

    await BloodBank.findByIdAndUpdate(bank._id, {
      $inc: { 'stats.totalUnitsCollected': 1, 'stats.totalDonations': 1 },
      $set: { 'stats.lastDonationAt': new Date() },
    });

    const addedUnit = updatedInv.units[updatedInv.units.length - 1];

    res.status(201).json({
      success: true,
      message: 'Blood unit added. Testing results pending.',
      data: addedUnit,
      hint: {
        nextStep: `PUT /blood-banks/me/inventory/${inv._id}/units/${addedUnit._id}`,
        payload: {
          testResults: {
            hiv: 'Non-Reactive', hbsAg: 'Non-Reactive',
            hcv: 'Non-Reactive', syphilis: 'Non-Reactive', malaria: 'Non-Reactive'
          },
          isTestingComplete: true,
          isReleaseApproved: true
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/inventory/:invId/units/:unitId  (BLOOD_BANK MANAGER)
 */
router.put('/me/inventory/:invId/units/:unitId', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    const unit = inv.units.id(req.params.unitId);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    const prevStatus            = unit.status;
    const prevIsReleaseApproved = unit.isReleaseApproved;

    const allowed = [
      'testResults', 'isTestingComplete', 'isReleaseApproved',
      'storageLocation', 'storageSlot', 'storageTemperatureC',
      'crossMatch', 'status', 'notes',
      'processedAt', 'processedBy', 'separationMethod',
      'transfusedAt', 'transfusedBy',
      'isRecalled', 'recallReason', 'recalledAt',
    ];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) unit[f] = req.body[f];
    });

    if (req.body.testResults) {
      const t = unit.testResults;
      unit.testResults.allClear = ['hiv', 'hbsAg', 'hcv', 'syphilis', 'malaria'].every(
        k => t[k] === 'Non-Reactive'
      );
      if (unit.testResults.allClear) unit.isTestingComplete = true;
    }

    const newStatus            = unit.status;
    const newIsReleaseApproved = unit.isReleaseApproved;

    if (!prevIsReleaseApproved && newIsReleaseApproved && newStatus === 'available') {
      inv.availableUnits++;
    }

    if (newStatus !== prevStatus) {
      if (prevStatus === 'available' && newStatus === 'quarantined') {
        if (prevIsReleaseApproved) inv.availableUnits = Math.max(0, inv.availableUnits - 1);
        inv.quarantinedUnits++;
      }
      if (prevStatus === 'quarantined' && newStatus === 'available' && newIsReleaseApproved) {
        inv.availableUnits++;
        inv.quarantinedUnits = Math.max(0, inv.quarantinedUnits - 1);
      }
      if (newStatus === 'discarded') {
        if (prevStatus === 'available' && prevIsReleaseApproved) {
          inv.availableUnits = Math.max(0, inv.availableUnits - 1);
        }
        if (prevStatus === 'quarantined') {
          inv.quarantinedUnits = Math.max(0, inv.quarantinedUnits - 1);
        }
        inv.discardedUnits++;
      }
    }

    inv.lastUpdatedAt = new Date();
    await inv.save();

    res.json({ success: true, message: 'Unit updated', data: unit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /blood-banks/me/inventory/:invId/expiry-check  (BLOOD_BANK MANAGER)
 */
router.post('/me/inventory/:invId/expiry-check', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    const updated = await BloodInventory.runExpiryCheck(inv._id);

    res.json({
      success: true,
      message: 'Expiry check complete',
      data: {
        expiringIn3Days: updated.expiringIn3Days,
        expiringIn7Days: updated.expiringIn7Days,
        expiredUnits:    updated.expiredUnits,
        nextExpiryAt:    updated.nextExpiryAt,
        availableUnits:  updated.availableUnits,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/requests/:reqId/respond  (BLOOD_BANK MANAGER)
 */
router.put('/me/requests/:reqId/respond', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'accept' or 'reject'" });
    }

    const bloodRequest = await BloodRequest.findById(req.params.reqId);
    if (!bloodRequest) return res.status(404).json({ success: false, message: 'Blood request not found' });

    if (action === 'accept') {
      bloodRequest.status    = 'cross_matching';
      bloodRequest.updatedBy = req.user._id;
      await bloodRequest.save();

      await Notification.create({
        recipient: bloodRequest.requestedBy,
        title:     'Blood Request Accepted',
        body:      `Your request ${bloodRequest.requestCode} has been accepted. Cross-matching in progress.`,
        type:      'Order_Placed',
        priority:  'High',
      }).catch(console.error);

    } else {
      const invDocs = await BloodInventory.find({ 'units.reservedFor': bloodRequest._id });
      for (const inv of invDocs) {
        await BloodInventory.releaseReservation(inv._id, bloodRequest._id);
      }

      bloodRequest.status          = 'rejected';
      bloodRequest.rejectionReason = reason || 'Blood bank declined the request';
      bloodRequest.rejectedBy      = req.user._id;
      bloodRequest.rejectedAt      = new Date();
      bloodRequest.updatedBy       = req.user._id;
      await bloodRequest.save();

      await Notification.create({
        recipient: bloodRequest.requestedBy,
        title:     'Blood Request Rejected',
        body:      `Request ${bloodRequest.requestCode} was rejected. Reason: ${reason || 'No reason provided'}`,
        type:      'Order_Placed',
        priority:  'High',
      }).catch(console.error);
    }

    res.json({
      success: true,
      message: action === 'accept'
        ? 'Request accepted. Prepare units for cross-matching.'
        : `Request rejected. Units released. Reason: ${reason || 'No reason provided'}`,
      data: { requestCode: bloodRequest.requestCode, status: bloodRequest.status },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/requests/:reqId/issue  (BLOOD_BANK MANAGER)
 */
router.put('/me/requests/:reqId/issue', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const {
      bagNumbers = [], issuedBy, receiptUrl, hospitalId,
      customerEmail, customerName, bloodGroup, component,
    } = req.body;

    if (!bagNumbers.length) {
      return res.status(400).json({ success: false, message: 'bagNumbers array required' });
    }

    const upperBags = bagNumbers.map(b => b.toUpperCase());
    let totalIssued = 0;

    const invDocs = await BloodInventory.find({
      bloodBank:         bank._id,
      'units.bagNumber': { $in: upperBags },
    });

    for (const inv of invDocs) {
      let changed = false;
      for (const unit of inv.units) {
        if (upperBags.includes(unit.bagNumber) && ['reserved', 'cross_matched'].includes(unit.status)) {
          unit.status   = 'issued';
          unit.issuedTo = {
            request:    req.params.reqId,
            hospital:   hospitalId || null,
            issuedAt:   new Date(),
            issuedBy:   issuedBy || req.user.name,
            receiptUrl: receiptUrl || null,
          };
          inv.issuedUnits++;
          inv.reservedUnits  = Math.max(0, inv.reservedUnits - 1);
          inv.availableUnits = Math.max(0, inv.availableUnits);
          totalIssued++;
          changed = true;
        }
      }
      if (changed) {
        inv.lastIssuanceAt = new Date();
        inv.lastUpdatedAt  = new Date();
        await inv.save();
      }
    }

    if (totalIssued === 0) {
      return res.status(400).json({ success: false, message: 'No matching reserved units found for those bag numbers' });
    }

    const bloodRequest = await BloodRequest.findById(req.params.reqId);
    if (bloodRequest) {
      bloodRequest.status    = 'dispatched';
      bloodRequest.updatedBy = req.user._id;
      await bloodRequest.save();
    }

    await BloodBank.findByIdAndUpdate(bank._id, {
      $inc: { 'stats.totalUnitsIssued': totalIssued, 'stats.totalRequestsFulfilled': 1 },
      $set: { 'stats.lastIssuanceAt': new Date() },
    });

    if (customerEmail) {
      await sendEmail({
        email:   customerEmail,
        subject: `Blood Units Dispatched — ${bloodGroup || ''} ${component || ''}`,
        html:    buildBloodIssuedEmail({
          userName:   customerName || 'Customer',
          requestId:  req.params.reqId,
          bloodGroup: bloodGroup || 'N/A',
          component:  component  || 'N/A',
          units:      totalIssued,
          bankName:   bank.name,
          bagNumbers: upperBags,
        }),
      }).catch(console.error);
    }

    await SystemLog.createLog({
      level: 'success', category: 'system',
      message: `Blood units issued: ${upperBags.join(', ')} for request ${req.params.reqId}`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { requestRef: req.params.reqId, bagNumbers: upperBags, totalIssued },
    });

    res.json({
      success: true,
      message: `${totalIssued} unit(s) issued successfully`,
      data:    { requestRef: req.params.reqId, bagNumbers: upperBags, totalIssued },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;