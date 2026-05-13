/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BLOOD BANK ROUTER — Likeson.in
 *
 * Routes:
 *   PUBLIC
 *   GET    /blood-banks                            list active banks
 *   GET    /blood-banks/nearby                     geospatial search
 *   GET    /blood-banks/slug/:slug                 by slug
 *   GET    /blood-banks/:id                        single bank
 *   GET    /blood-banks/:id/inventory              stock summary
 *   GET    /blood-banks/:id/inventory/search       filter by bloodGroup+component
 *
 *   CUSTOMER (protect + authorize('customer'))
 *   POST   /blood-banks/:id/request                place blood request (Razorpay order)
 *   POST   /blood-banks/request/verify-payment     verify Razorpay payment
 *   GET    /blood-banks/:id/reviews                get reviews
 *   POST   /blood-banks/:id/reviews                post review
 *
 *   BLOOD_BANK MANAGER (protect + authorize('blood_bank'))
 *   POST   /blood-banks                            create bank
 *   GET    /blood-banks/me                         own profile
 *   PUT    /blood-banks/me                         update profile
 *   PUT    /blood-banks/me/logo                    upload logo (ImageKit)
 *   PUT    /blood-banks/me/licenses                add/update license doc (ImageKit upload)
 *   PUT    /blood-banks/me/accreditations          add/update accreditation doc
 *   PUT    /blood-banks/me/bank-details            settlement bank account
 *   PUT    /blood-banks/me/stock-alerts            set threshold configs
 *   PUT    /blood-banks/me/pricing                 update processing fees
 *   GET    /blood-banks/me/inventory               full inventory
 *   POST   /blood-banks/me/inventory               create inventory slot
 *   POST   /blood-banks/me/inventory/:invId/units  add blood unit (bag)
 *   PUT    /blood-banks/me/inventory/:invId/units/:unitId  update unit
 *   POST   /blood-banks/me/inventory/:invId/expiry-check   run expiry sweep
 *   GET    /blood-banks/me/requests                incoming blood requests
 *   PUT    /blood-banks/me/requests/:reqId/respond accept/reject
 *   PUT    /blood-banks/me/requests/:reqId/issue   mark units issued → send email
 *   GET    /blood-banks/me/stats                   stats + earnings
 *   GET    /blood-banks/me/status-log              status history
 *
 *   HOSPITAL (protect + authorize('hospital'))
 *   GET    /blood-banks/linked                     banks linked to my hospital
 *   POST   /blood-banks/:id/link                   request supply agreement
 *   DELETE /blood-banks/:id/link                   remove supply agreement
 *
 *   ADMIN (protect + authorize('admin','superadmin'))
 *   GET    /admin/blood-banks                      all banks any status
 *   GET    /admin/blood-banks/:id                  full doc incl internalNotes
 *   PUT    /admin/blood-banks/:id/status           change status
 *   PUT    /admin/blood-banks/:id/verify           mark verified
 *   PUT    /admin/blood-banks/:id/featured         toggle featured
 *   PUT    /admin/blood-banks/:id/licenses/:licId/verify  verify license
 *   DELETE /admin/blood-banks/:id                  hard delete
 *   GET    /admin/blood-banks/:id/stats            admin stats
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express        from 'express';
import multer         from 'multer';
import crypto         from 'crypto';
import Razorpay       from 'razorpay';
import ImageKit       from 'imagekit';

import dotenv         from 'dotenv';
import sendEmail       from '../utils/sendEmail.js';
import { buildBloodRequestEmail, buildBloodIssuedEmail } from '../utils/emailTemplates.js';
import BloodBank      from '../models/BloodBank.js';
import BloodInventory from '../models/BloodInventory.js';
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
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY  || 'public_rIdrz0GPllpCv0Q3HzChmkN+sLg=',
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY || 'private_VZy2yDP9AuEzZRr8BYHhSFWJA/c=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/zxxzgk3iq',
});

// ── Multer (memory) ───────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Router ────────────────────────────────────────────────────────────────────
const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Upload buffer to ImageKit, return URL */
const uploadToImageKit = (buffer, fileName, folder) =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      { file: buffer, fileName, folder: `/likeson/${folder}` },
      (err, result) => (err ? reject(err) : resolve(result.url))
    );
  });

/** Verify Razorpay signature */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body    = `${orderId}|${paymentId}`;
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
 * List active blood banks. Filters: city, bankType, bloodGroup, component, emergency, featured, page, limit
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
    if (city)       filter['address.city']      = new RegExp(city, 'i');
    if (bankType)   filter.bankType              = bankType;
    if (bloodGroup) filter.bloodGroupsAvailable  = bloodGroup;
    if (component)  filter.componentsHandled      = component;
    if (emergency === 'true') filter.isEmergency24x7 = true;
    if (featured  === 'true') filter.isFeatured       = true;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await BloodBank.countDocuments(filter);
    const banks = await BloodBank.find(filter)
      .select('-statusLog -internalNotes -bankDetails -licenses -accreditations')
      .sort({ isFeatured: -1, 'rating.averageRating': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      total,
      page:    parseInt(page),
      pages:   Math.ceil(total / parseInt(limit)),
      data:    banks,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/nearby
 * Geospatial search.
 * Query: lng, lat, radius (km), bloodGroup, component, unitsNeeded
 */
router.get('/nearby', async (req, res) => {
  try {
    const {
      lng, lat,
      radius     = 20,
      bloodGroup,
      component,
      unitsNeeded = 1,
    } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'lng and lat required' });
    }

    if (bloodGroup && component) {
      // Use BloodInventory geospatial static
      const results = await BloodInventory.findAvailableNearby({
        bloodGroup,
        component,
        unitsNeeded: parseInt(unitsNeeded),
        lng:         parseFloat(lng),
        lat:         parseFloat(lat),
        maxDistanceMeters: parseFloat(radius) * 1000,
      });
      return res.json({ success: true, data: results });
    }

    // Just find banks nearby
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

/**
 * GET /blood-banks/linked  (HOSPITAL — placed before /:id to avoid param collision)
 * Returns blood banks linked to the logged-in hospital manager's hospital.
 */
router.get('/linked', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const banks = await BloodBank.find({
      $or: [
        { hospital:       hospital._id },
        { linkedHospitals: hospital._id },
      ],
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
 */
router.get('/me/inventory', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id }).lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inventory = await BloodInventory.find({ bloodBank: bank._id })
      .select('-units')  // exclude heavy units array by default
      .lean();

    res.json({ success: true, data: inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/me/requests  (BLOOD_BANK MANAGER)
 * Placeholder — BloodRequest model to be implemented separately.
 * Returns 501 with guidance.
 */
router.get('/me/requests', protect, authorize('blood_bank'), async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'BloodRequest model not yet implemented. Create BloodRequest model with fields: bloodBank, customer, bloodGroup, component, unitsRequested, status, payment, etc.',
  });
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

    // Inventory summary
    const invSummary = await BloodInventory.aggregate([
      { $match: { bloodBank: bank._id } },
      { $group: {
        _id:            null,
        totalAvailable: { $sum: '$availableUnits' },
        totalReserved:  { $sum: '$reservedUnits' },
        totalIssued:    { $sum: '$issuedUnits' },
        totalExpired:   { $sum: '$expiredUnits' },
        lowStockCount:  { $sum: { $cond: ['$isLowStock', 1, 0] } },
        criticalCount:  { $sum: { $cond: ['$isCriticalStock', 1, 0] } },
      }},
    ]);

    res.json({
      success: true,
      data: {
        bank:      { name: bank.name, bankCode: bank.bankCode, rating: bank.rating },
        stats:     bank.stats,
        inventory: invSummary[0] || {},
      },
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

// ── ADMIN routes (before /:id) ─────────────────────────────────────────────

/**
 * GET /blood-banks/admin/all  (ADMIN)
 */
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

/**
 * GET /blood-banks/admin/:id  (ADMIN)
 */
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

/**
 * GET /blood-banks/admin/:id/stats  (ADMIN)
 */
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

/**
 * PUT /blood-banks/admin/:id/status  (ADMIN)
 * Body: { status, reason }
 */
router.put('/admin/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, reason } = req.body;
    const valid = ['pending', 'under_review', 'active', 'suspended', 'revoked', 'deactivated'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${valid.join(', ')}` });
    }

    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const prevStatus     = bank.status;
    bank.status          = status;
    bank.updatedBy       = req.user._id;
    if (status === 'suspended') bank.suspensionReason = reason || 'Administrative action';
    if (status === 'revoked')   bank.rejectionReason  = reason || 'License revoked';
    await bank.save();

    // Notify bank manager
    const manager = await User.findById(bank.managedBy).select('email name');
    if (manager?.email) {
      await sendEmail({
        email:   manager.email,
        subject: `Blood Bank Status Update — ${bank.name}`,
        html: `<p>Hi ${manager.name},</p><p>Your blood bank <strong>${bank.name}</strong> status has been changed from <strong>${prevStatus}</strong> to <strong>${status}</strong>. ${reason ? `Reason: ${reason}` : ''}</p>`,
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

/**
 * PUT /blood-banks/admin/:id/verify  (ADMIN)
 */
router.put('/admin/:id/verify', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    bank.isVerified  = true;
    bank.verifiedAt  = new Date();
    bank.verifiedBy  = req.user._id;
    bank.status      = 'active';
    bank.updatedBy   = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'Blood bank verified and activated', data: { isVerified: true, status: bank.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/admin/:id/featured  (ADMIN)
 */
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

/**
 * PUT /blood-banks/admin/:id/licenses/:licId/verify  (ADMIN)
 */
router.put('/admin/:id/licenses/:licId/verify', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const lic = bank.licenses.id(req.params.licId);
    if (!lic) return res.status(404).json({ success: false, message: 'License not found' });

    lic.isVerified  = true;
    lic.verifiedBy  = req.user._id;
    lic.verifiedAt  = new Date();
    bank.updatedBy  = req.user._id;
    await bank.save();

    res.json({ success: true, message: 'License verified', data: lic });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /blood-banks/admin/:id  (ADMIN — hard delete)
 */
router.delete('/admin/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    const bank = await BloodBank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    // Also delete all inventory docs for this bank
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
// ── PARAM ROUTES (/:id) ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /blood-banks/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true })
      .select('-internalNotes -bankDetails -statusLog')
      .lean();
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/:id/inventory
 * Public stock summary (no units array)
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
 * Query: bloodGroup, component, unitsNeeded
 */
router.get('/:id/inventory/search', async (req, res) => {
  try {
    const { bloodGroup, component, unitsNeeded = 1 } = req.query;
    const filter = { bloodBank: req.params.id };
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (component)  filter.component  = component;
    if (unitsNeeded > 0) filter.availableUnits = { $gte: parseInt(unitsNeeded) };

    const results = await BloodInventory.find(filter)
      .select('-units')
      .lean();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /blood-banks/:id/reviews
 * TODO: implement Review model. Returns 501 for now.
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
 * Creates Razorpay order for blood processing fee.
 * Body: { bloodGroup, component, unitsNeeded, patientName, hospitalId?, urgency, notes }
 */
router.post('/:id/request', protect, authorize('customer'), async (req, res) => {
  try {
    const { bloodGroup, component, unitsNeeded = 1, patientName, hospitalId, urgency = 'routine', notes } = req.body;

    if (!bloodGroup || !component) {
      return res.status(400).json({ success: false, message: 'bloodGroup and component required' });
    }

    const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true, status: 'active' });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found or inactive' });

    // Check inventory
    const inv = await BloodInventory.findOne({
      bloodBank:      bank._id,
      bloodGroup,
      component,
      availableUnits: { $gte: parseInt(unitsNeeded) },
    });
    if (!inv) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Requested ${unitsNeeded} unit(s) of ${bloodGroup} ${component} — not available at this bank.`,
      });
    }

    // Calculate processing fee
    const pricingEntry  = bank.pricing?.find(p => p.component === component);
    const feePerUnit    = pricingEntry?.processingFee || inv.processingFeePerUnit || 0;
    const crossMatchFee = pricingEntry?.crossMatchFee || inv.crossMatchFeePerUnit || 0;
    const totalFee      = (feePerUnit + crossMatchFee) * parseInt(unitsNeeded);

    // Create Razorpay order (amount in paise)
    const rzpOrder = await razorpay.orders.create({
      amount:   Math.round(totalFee * 100),
      currency: 'INR',
      receipt:  `bb_req_${Date.now()}`,
      notes: {
        bloodBankId: bank._id.toString(),
        bloodGroup,
        component,
        unitsNeeded: unitsNeeded.toString(),
        customerId:  req.user._id.toString(),
        patientName: patientName || req.user.name,
      },
    });

    res.json({
      success: true,
      message: 'Razorpay order created. Complete payment to confirm blood request.',
      data: {
        razorpayOrderId: rzpOrder.id,
        amount:          totalFee,
        currency:        'INR',
        bankName:        bank.name,
        bloodGroup,
        component,
        unitsNeeded:     parseInt(unitsNeeded),
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
});

/**
 * POST /blood-banks/request/verify-payment  (CUSTOMER)
 * Called after Razorpay payment success.
 * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, bloodBankId, bloodGroup, component, unitsNeeded, patientName, hospitalId, notes }
 */
router.post('/request/verify-payment', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      razorpayOrderId, razorpayPaymentId, razorpaySignature,
      bloodBankId, bloodGroup, component, unitsNeeded = 1,
      patientName, hospitalId, notes,
    } = req.body;

    // Verify signature
    const valid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    const bank = await BloodBank.findById(bloodBankId);
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    // Reserve units atomically
    const inv = await BloodInventory.findOne({
      bloodBank: bloodBankId,
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

    // Generate a request reference (BloodRequest model to be implemented)
    const requestRef = `BR-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}`;

    const reserved = await BloodInventory.reserveUnits(inv._id, requestRef, parseInt(unitsNeeded));
    if (!reserved) {
      return res.status(400).json({ success: false, message: 'Reservation failed. Stock may have been taken.' });
    }

    // In-app notification to blood_bank manager
    const manager = await User.findById(bank.managedBy).select('_id email name');
    await Notification.create({
      recipient: manager._id,
      title:     `New Blood Request — ${bloodGroup} ${component}`,
      body:      `${unitsNeeded} unit(s) of ${bloodGroup} ${component} requested. Ref: ${requestRef}`,
      type:      'Order_Placed',
      priority:  'High',
      deepLink:  { screen: 'BloodRequests', referenceId: bank._id },
    });

    // Email to customer
    const customer = req.user;
    await sendEmail({
      email:   customer.email,
      subject: `Blood Request Confirmed — ${bloodGroup} ${component}`,
      html:    buildBloodRequestEmail({
        userName:      customer.name,
        requestId:     requestRef,
        bloodGroup,
        component,
        units:         unitsNeeded,
        bankName:      bank.name,
        processingFee: 'Already paid',
      }),
    }).catch(console.error);

    // Email to manager
    if (manager?.email) {
      await sendEmail({
        email:   manager.email,
        subject: `New Blood Request Received — ${bloodGroup} ${component}`,
        html:    buildBloodRequestEmail({
          userName:      manager.name,
          requestId:     requestRef,
          bloodGroup,
          component,
          units:         unitsNeeded,
          bankName:      bank.name,
          processingFee: 'Processing fee collected',
        }),
      }).catch(console.error);
    }

    await SystemLog.createLog({
      level: 'success', category: 'payment',
      message: `Blood request payment verified: ${requestRef}`,
      actor:   { userId: customer._id, name: customer.name, role: customer.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { requestRef, bloodGroup, component, unitsNeeded, razorpayOrderId, razorpayPaymentId },
    });

    res.json({
      success: true,
      message: 'Payment verified. Blood units reserved. Blood bank notified.',
      data:    { requestRef, bloodGroup, component, unitsNeeded: parseInt(unitsNeeded), bankName: bank.name },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── BLOOD_BANK MANAGER ROUTES ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /blood-banks  (BLOOD_BANK MANAGER)
 * Create blood bank profile.
 * Body: { name, bankType, contact, address, description, componentsHandled, bloodGroupsAvailable, ...}
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

    // If hospital_embedded, add to hospital.bloodBanks
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
 * Update profile fields (contact, hours, services, address, description, etc.)
 * NOT: logo, licenses, accreditations, bankDetails, stockAlerts, pricing (separate endpoints)
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
 * Multipart: field name = logo
 */
router.put('/me/logo', protect, authorize('blood_bank'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const url = await uploadToImageKit(
      req.file.buffer,
      `logo_${bank.bankCode}_${Date.now()}`,
      'blood-banks/logos'
    );

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
 * Multipart: field name = document
 * Body fields: licenseType, licenseNumber, issuedBy, issuedOn, validUntil
 * If licenseId in body → update existing, else → push new
 */
router.put('/me/licenses', protect, authorize('blood_bank'), upload.single('document'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { licenseId, licenseType, licenseNumber, issuedBy, issuedOn, validUntil } = req.body;

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(
        req.file.buffer,
        `lic_${bank.bankCode}_${Date.now()}`,
        'blood-banks/licenses'
      );
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
      lic.isVerified = false; // reset on update
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
 * Multipart: field name = document
 * Body: accreditationId (optional), body, certificateNo, issuedOn, validUntil
 */
router.put('/me/accreditations', protect, authorize('blood_bank'), upload.single('document'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { accreditationId, body: accBody, certificateNo, issuedOn, validUntil } = req.body;

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(
        req.file.buffer,
        `acc_${bank.bankCode}_${Date.now()}`,
        'blood-banks/accreditations'
      );
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
 * Body: { accountHolderName, accountNumber, ifscCode, bankName, upiId }
 */
router.put('/me/bank-details', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const allowed = ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName', 'upiId'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) bank.bankDetails[f] = req.body[f];
    });

    bank.bankDetails.isVerified = false; // reset on update — admin must re-verify
    bank.updatedBy = req.user._id;
    await bank.save();

    res.json({
      success: true,
      message: 'Bank details updated. Admin verification required.',
      data:    { accountLast4: bank.bankDetails.accountLast4, bankName: bank.bankDetails.bankName, upiId: bank.bankDetails.upiId },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/stock-alerts  (BLOOD_BANK MANAGER)
 * Body: { stockAlerts: [{ bloodGroup, component, minThreshold, criticalThreshold }] }
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
 * Body: { pricing: [{ component, processingFee, crossMatchFee, storageFee }] }
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

    // Sync processingFeePerUnit in BloodInventory docs for each component
    for (const entry of req.body.pricing) {
      await BloodInventory.updateMany(
        { bloodBank: bank._id, component: entry.component },
        {
          $set: {
            processingFeePerUnit: entry.processingFee  || 0,
            crossMatchFeePerUnit: entry.crossMatchFee  || 0,
          },
        }
      );
    }

    res.json({ success: true, message: 'Pricing updated', data: bank.pricing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /blood-banks/me/inventory  (BLOOD_BANK MANAGER)
 * Create a new inventory slot (one per bloodGroup+component combination).
 * Body: { bloodGroup, component, processingFeePerUnit, crossMatchFeePerUnit }
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
 * Add a new blood unit (bag) to an inventory slot.
 * Multipart optional (no file here — just JSON body).
 * Body: { bagNumber, collectedAt, volumeMl, donorCode, donorName, collectedByStaff, expiresAt, storageLocation, storageSlot }
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

    const updatedInv = await BloodInventory.addUnit(inv._id, {
      bagNumber, collectedAt, volumeMl,
      donorCode: donorCode || 'WALK-IN',
      donorName,
      collectedByStaff,
      expiresAt,
      storageLocation,
      storageSlot,
      status: 'available',
      // Testing defaults to Pending — unit not released until allClear = true
    });

    // Update bank stats
    await BloodBank.findByIdAndUpdate(bank._id, { $inc: { 'stats.totalUnitsCollected': 1, 'stats.totalDonations': 1 }, $set: { 'stats.lastDonationAt': new Date() } });

    res.status(201).json({
      success: true,
      message: 'Blood unit added. Testing pending before release.',
      data:    updatedInv.units[updatedInv.units.length - 1],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/inventory/:invId/units/:unitId  (BLOOD_BANK MANAGER)
 * Update unit fields: test results, storage, status, cross-match result, release approval.
 * Body: any subset of bloodUnitSchema fields.
 */
router.put('/me/inventory/:invId/units/:unitId', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const inv = await BloodInventory.findOne({ _id: req.params.invId, bloodBank: bank._id });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory slot not found' });

    const unit = inv.units.id(req.params.unitId);
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    const prevStatus = unit.status;

    // Allowed fields to update
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

    // Auto-set allClear if all tests Non-Reactive
    if (req.body.testResults) {
      const t = unit.testResults;
      unit.testResults.allClear = ['hiv','hbsAg','hcv','syphilis','malaria'].every(
        k => t[k] === 'Non-Reactive'
      );
    }

    // Counter adjustments based on status change
    if (req.body.status && req.body.status !== prevStatus) {
      if (prevStatus === 'available' && req.body.status === 'quarantined') {
        inv.availableUnits  = Math.max(0, inv.availableUnits - 1);
        inv.quarantinedUnits++;
      }
      if (prevStatus === 'quarantined' && req.body.status === 'available') {
        inv.availableUnits++;
        inv.quarantinedUnits = Math.max(0, inv.quarantinedUnits - 1);
      }
      if (req.body.status === 'discarded') {
        if (prevStatus === 'available')   inv.availableUnits   = Math.max(0, inv.availableUnits - 1);
        if (prevStatus === 'quarantined') inv.quarantinedUnits = Math.max(0, inv.quarantinedUnits - 1);
        inv.discardedUnits++;
      }
      // If unit is approved and available, bump availableUnits (was not counted before release)
      if (req.body.status === 'available' && req.body.isReleaseApproved === true && prevStatus !== 'available') {
        inv.availableUnits++;
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
 * Trigger expiry sweep for a specific inventory slot.
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
 * Accept or reject a blood request.
 * Body: { action: 'accept' | 'reject', reason }
 * NOTE: This is a stub — a full BloodRequest model is needed.
 * The stub updates reservation status in BloodInventory if reject.
 */
router.put('/me/requests/:reqId/respond', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'accept' or 'reject'" });
    }

    // If rejecting, release reservation
    if (action === 'reject') {
      // Find inventory docs with units reserved for this requestId
      const invDocs = await BloodInventory.find({ 'units.reservedFor': req.params.reqId });
      for (const inv of invDocs) {
        await BloodInventory.releaseReservation(inv._id, req.params.reqId);
      }
    }

    res.json({
      success: true,
      message: action === 'accept'
        ? 'Request accepted. Prepare units for issuance.'
        : `Request rejected. Units released. Reason: ${reason || 'No reason provided'}`,
      data: { requestRef: req.params.reqId, action },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /blood-banks/me/requests/:reqId/issue  (BLOOD_BANK MANAGER)
 * Mark blood units as issued.
 * Body: { bagNumbers: string[], issuedBy, receiptUrl?, hospitalId?, customerEmail?, customerName? }
 * Sends issuance confirmation email to customer.
 */
router.put('/me/requests/:reqId/issue', protect, authorize('blood_bank'), async (req, res) => {
  try {
    const bank = await BloodBank.findOne({ managedBy: req.user._id });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    const { bagNumbers = [], issuedBy, receiptUrl, hospitalId, customerEmail, customerName, bloodGroup, component } = req.body;

    if (!bagNumbers.length) {
      return res.status(400).json({ success: false, message: 'bagNumbers array required' });
    }

    // Find inventory docs containing these bag numbers and update them
    let totalIssued = 0;
    const invDocs = await BloodInventory.find({
      bloodBank: bank._id,
      'units.bagNumber': { $in: bagNumbers.map(b => b.toUpperCase()) },
    });

    for (const inv of invDocs) {
      let changed = false;
      for (const unit of inv.units) {
        if (bagNumbers.map(b => b.toUpperCase()).includes(unit.bagNumber)) {
          unit.status    = 'issued';
          unit.issuedTo  = {
            request:    req.params.reqId,
            hospital:   hospitalId || null,
            issuedAt:   new Date(),
            issuedBy:   issuedBy || req.user.name,
            receiptUrl: receiptUrl || null,
          };
          totalIssued++;
          changed = true;
        }
      }
      if (changed) {
        inv.issuedUnits    += totalIssued;
        inv.reservedUnits   = Math.max(0, inv.reservedUnits - totalIssued);
        inv.lastIssuanceAt  = new Date();
        inv.lastUpdatedAt   = new Date();
        await inv.save();
      }
    }

    // Update bank stats
    await BloodBank.findByIdAndUpdate(bank._id, {
      $inc: { 'stats.totalUnitsIssued': totalIssued, 'stats.totalRequestsFulfilled': 1 },
      $set: { 'stats.lastIssuanceAt': new Date() },
    });

    // Send email to customer if provided
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
          bagNumbers,
        }),
      }).catch(console.error);
    }

    await SystemLog.createLog({
      level: 'success', category: 'system',
      message: `Blood units issued: ${bagNumbers.join(', ')} for request ${req.params.reqId}`,
      actor:   { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'BloodBank', entityId: bank._id, label: bank.name },
      metadata: { requestRef: req.params.reqId, bagNumbers, totalIssued },
    });

    res.json({
      success: true,
      message: `${totalIssued} unit(s) issued successfully`,
      data:    { requestRef: req.params.reqId, bagNumbers, totalIssued },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── HOSPITAL ROUTES ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /blood-banks/:id/link  (HOSPITAL)
 * Add supply agreement between hospital and blood bank.
 */
router.post('/:id/link', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id });
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const bank = await BloodBank.findOne({ _id: req.params.id, isActive: true });
    if (!bank) return res.status(404).json({ success: false, message: 'Blood bank not found' });

    // Add hospital to bank's linkedHospitals and vice versa
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

export default router;