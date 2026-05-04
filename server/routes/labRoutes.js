/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAB PARTNER COMPLETE ROUTER — Likeson.in
 *
 * Four role groups:
 *  1. PUBLIC          — no auth required (browse labs, tests, packages)
 *  2. CUSTOMER        — authenticated customers (book, review, track)
 *  3. LAB PARTNER     — the lab itself (view own profile, manage tests/packages,
 *                       view own bookings, update bank details, settings, security)
 *  4. ADMIN / SUPERADMIN — full control (create, approve, suspend, fee overrides,
 *                           verify docs, manage reviews)
 *
 * Mount at:  app.use('/api/labs', labRouter);
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express            from 'express';
import bcrypt             from 'bcryptjs';
import ImageKit           from 'imagekit';
import multer             from 'multer';
import mongoose           from 'mongoose';
import crypto             from 'crypto';

import User               from '../models/User.js';
import LabPartnerProfile  from '../models/LabPartnerProfile.js';
import SystemLog          from '../models/SystemLog.js';
import Notification       from '../models/Notification.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import sendEmail          from '../utils/sendEmail.js';
import asyncHandler       from '../utils/asyncHandler.js';
import cache              from '../middleware/cache.js';
import {
  invalidatePattern,
  invalidateKey,
  invalidateKeys,
}                         from '../utils/cacheInvalidation.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// ImageKit client
// ─────────────────────────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ─────────────────────────────────────────────────────────────────────────────
// Multer — memory storage, 10 MB limit
// ─────────────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Upload a buffer to ImageKit, returns the CDN URL */
const uploadToImageKit = (buffer, fileName, folder = 'labs') =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      {
        file:     buffer,
        fileName: `${Date.now()}_${fileName}`,
        folder:   `/likeson/${folder}`,
      },
      (err, result) => (err ? reject(err) : resolve(result.url))
    );
  });

/** Random password generator */
const generatePassword = (len = 12) => {
  const chars =
    'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  return Array.from(
    { length: len },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
};

/** Generate a 6-digit numeric OTP */
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/** Parse a JSON field from req.body (sent as string from multipart forms) */
const parseJSON = (val) => {
  if (!val) return undefined;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return undefined; } }
  return val;
};

/** Invalidate all cache keys related to a specific lab */
const invalidateLabCaches = async (labId) => {
  await invalidateKeys([
    `lab:${labId}`,
    `GET:/api/labs/${labId}`,
    `GET:/api/labs/admin/${labId}`,
  ]);
  await invalidatePattern('GET:/api/labs*');
};

// ─────────────────────────────────────────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────────────────────────────────────────

/** Welcome email sent when admin creates a lab account */
const buildLabWelcomeEmail = ({ labName, name, email, password }) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<style>body{margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;}</style>
</head><body>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 10px;">
<table width="620" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:12px;overflow:hidden;
              box-shadow:0 8px 24px rgba(0,0,0,.07);border:1px solid #eef2f6;
              max-width:620px;width:100%;">
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);
               padding:36px 40px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">
        🏥 LIKESON HEALTHCARE</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:6px;">Lab Partner Onboarding</div>
    </td>
  </tr>
  <tr><td style="padding:32px 40px 16px;">
    <h2 style="margin:0;color:#1e293b;font-size:20px;font-weight:700;">
      Welcome aboard, ${labName}! 🎉</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin:12px 0 0;">
      Hi <strong>${name}</strong>, your lab partner account has been set up on Likeson Healthcare.
      Use the credentials below to log in and complete your profile.</p>
  </td></tr>
  <tr><td style="padding:8px 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f1f5f9;border-radius:10px;border:1px solid #e2e8f0;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" style="font-size:13px;color:#374151;">
          <tr>
            <td style="color:#64748b;padding:6px 0;width:120px;">Login Email</td>
            <td style="font-weight:700;color:#1e293b;padding:6px 0;">${email}</td>
          </tr>
          <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e2e8f0;margin:4px 0;"/></td></tr>
          <tr>
            <td style="color:#64748b;padding:6px 0;">Temp Password</td>
            <td style="font-family:'Courier New',monospace;font-size:17px;
                       font-weight:800;color:#0f3460;letter-spacing:2px;padding:6px 0;">
              ${password}</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 40px 20px;">
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
      <p style="color:#854d0e;font-size:12px;margin:0;line-height:1.6;">
        ⚠️ <strong>Change your password</strong> immediately after first login.
        Never share your credentials.</p>
    </div>
  </td></tr>
  <tr><td style="padding:0 40px 36px;text-align:center;">
    <a href="${process.env.FRONTEND_URL}/login"
       style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);
              color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;
              font-weight:700;font-size:14px;">🔐 Login to Dashboard</a>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;
                 padding:16px 40px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      © ${new Date().getFullYear()} LIKESON.IN &nbsp;|&nbsp;
      <a href="mailto:support@likeson.in" style="color:#007bff;text-decoration:none;">
        support@likeson.in</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

/** Generic status notification email */
const buildStatusEmail = (subject, body) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head><body
  style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 10px;">
<table width="580" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:12px;overflow:hidden;
              box-shadow:0 8px 24px rgba(0,0,0,.07);border:1px solid #eef2f6;
              max-width:580px;width:100%;">
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);
               padding:28px 40px;text-align:center;">
      <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:1.5px;">
        🏥 LIKESON HEALTHCARE</div>
    </td>
  </tr>
  <tr><td style="padding:28px 40px;">
    <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">${subject}</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">${body}</p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;
                 padding:14px 40px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      Likeson Healthcare &bull;
      <a href="mailto:support@likeson.in" style="color:#007bff;">support@likeson.in</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

/** OTP / Security alert email for lab partner */
const buildSecurityAlertEmail = ({ name, action, otp, ipAddress, deviceInfo, timestamp }) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head><body
  style="margin:0;padding:0;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 10px;">
<table width="580" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:12px;overflow:hidden;
              box-shadow:0 8px 24px rgba(0,0,0,.07);border:1px solid #eef2f6;
              max-width:580px;width:100%;">
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a2e 0%,#7c2d12 60%,#991b1b 100%);
               padding:28px 40px;text-align:center;">
      <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:1.5px;">
        🔐 LIKESON SECURITY ALERT</div>
    </td>
  </tr>
  <tr><td style="padding:28px 40px 16px;">
    <h2 style="margin:0 0 10px;color:#1e293b;font-size:18px;">Hi ${name},</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;">${action}</p>
    ${otp ? `
    <div style="background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:8px;
                padding:20px;text-align:center;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:2px;
                  text-transform:uppercase;margin-bottom:8px;">Verification Code</div>
      <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;
                   letter-spacing:8px;color:#1e293b;">${otp}</span>
      <div style="color:#94a3b8;font-size:11px;margin-top:8px;">Expires in 10 minutes</div>
    </div>` : ''}
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;">
      <p style="color:#991b1b;font-size:12px;margin:0 0 6px;font-weight:700;">Security Details</p>
      <p style="color:#7f1d1d;font-size:12px;margin:0;line-height:1.7;">
        📍 IP: ${ipAddress || 'Unknown'}<br/>
        💻 Device: ${deviceInfo || 'Unknown'}<br/>
        🕐 Time: ${timestamp || new Date().toLocaleString('en-IN')}
      </p>
    </div>
    <p style="color:#94a3b8;font-size:11px;margin:16px 0 0;line-height:1.6;">
      If you did not initiate this action, please contact
      <a href="mailto:security@likeson.in" style="color:#007bff;">security@likeson.in</a>
      immediately.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;
                 padding:14px 40px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      Likeson Healthcare &bull;
      <a href="mailto:support@likeson.in" style="color:#007bff;">support@likeson.in</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

// ═════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES — No authentication required
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/labs/public
 * Browse approved & active labs. Supports search, filter, sort, pagination.
 * Cached 120 s.
 */
router.get(
  '/public',
  cache(120),
  asyncHandler(async (req, res) => {
    const {
      page      = 1,
      limit     = 20,
      labType,
      city,
      search,
      sampleCollectionMode,
      sortBy    = 'averageRating',
      sortOrder = 'desc',
      lat, lng, radiusKm = 10,
    } = req.query;

    const filter = { status: 'approved', isActive: true };

    if (labType)              filter.labType = labType;
    if (sampleCollectionMode) filter.sampleCollectionMode = sampleCollectionMode;
    if (city) filter['registeredAddress.city'] = { $regex: city, $options: 'i' };

    if (search) {
      filter.$or = [
        { labName: { $regex: search, $options: 'i' } },
        { tags:    { $regex: search, $options: 'i' } },
        { 'registeredAddress.city':  { $regex: search, $options: 'i' } },
        { 'labTests.testName':       { $regex: search, $options: 'i' } },
      ];
    }

    if (lat && lng) {
      filter['registeredAddress.location'] = {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radiusKm) * 1000,
        },
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [labs, total] = await Promise.all([
      LabPartnerProfile.find(filter)
        .select(
          'labName labCode labType ownershipType description logoUrl coverImageUrl ' +
          'registeredAddress sampleCollectionMode homeCollectionRadius homeCollectionFee ' +
          'reportDeliveryModes avgTurnaroundHours averageRating totalReviews ' +
          'accreditations isFeatured isVerified tags timing'
        )
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      LabPartnerProfile.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: labs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  })
);

/**
 * GET /api/labs/public/featured
 * Featured labs only. Cached 300 s.
 */
router.get(
  '/public/featured',
  cache(300),
  asyncHandler(async (req, res) => {
    const labs = await LabPartnerProfile.find({
      status: 'approved', isActive: true, isFeatured: true,
    })
      .select(
        'labName labCode labType logoUrl coverImageUrl registeredAddress ' +
        'averageRating totalReviews sampleCollectionMode tags isVerified'
      )
      .sort({ averageRating: -1 })
      .limit(12)
      .lean();

    return res.status(200).json({ success: true, data: labs });
  })
);

/**
 * GET /api/labs/public/:id
 * Public detail for one lab (approved + active only). Cached 60 s.
 */
router.get(
  '/public/:id',
  cache(60, (req) => `lab:${req.params.id}:public`),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findOne({
      _id:      req.params.id,
      status:   'approved',
      isActive: true,
    })
      .select('-user -bankDetails -complianceDocs -statusLog -createdBy -updatedBy -platformFee')
      .lean({ virtuals: true });

    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found or not available.' });
    }

    return res.status(200).json({ success: true, data: lab });
  })
);

/**
 * GET /api/labs/public/:id/tests
 * List active tests for a lab. Cached 60 s.
 */
router.get(
  '/public/:id/tests',
  cache(60, (req) => `lab:${req.params.id}:tests:public`),
  asyncHandler(async (req, res) => {
    const { category, search } = req.query;

    const lab = await LabPartnerProfile.findOne({
      _id: req.params.id, status: 'approved', isActive: true,
    }).select('labName labTests').lean();

    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    let tests = lab.labTests.filter((t) => t.isActive);

    if (category) tests = tests.filter((t) => t.category?.toLowerCase() === category.toLowerCase());
    if (search)   tests = tests.filter((t) => t.testName?.toLowerCase().includes(search.toLowerCase()));

   // replace return line:
return res.status(200).json({
  success: true,
  labName: lab.labName,
  total:   tests.length,
  data:    tests.map(({ partnerPrice: _, ...t }) => t),  // strip partner price
});
  })
);

/**
 * GET /api/labs/public/:id/packages
 * List active packages for a lab. Cached 60 s.
 */
router.get(
  '/public/:id/packages',
  cache(60, (req) => `lab:${req.params.id}:packages:public`),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findOne({
      _id: req.params.id, status: 'approved', isActive: true,
    }).select('labName labPackages labTests').lean();

    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const activePackages = lab.labPackages.filter((p) => p.isActive);
    return res.status(200).json({
      success: true,
      labName: lab.labName,
      total:   activePackages.length,
      data:    activePackages,
    });
  })
);

/**
 * GET /api/labs/public/:id/reviews
 * Public reviews (visible only). Paginated.
 */
router.get(
  '/public/:id/reviews',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const lab = await LabPartnerProfile.findOne({
      _id: req.params.id, status: 'approved', isActive: true,
    })
      .populate('reviews.user', 'name avatar')
      .select('labName reviews averageRating totalReviews')
      .lean();

    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const visible = lab.reviews.filter((r) => r.isVisible);
    const start   = (Number(page) - 1) * Number(limit);
    const paged   = visible.slice(start, start + Number(limit));

    return res.status(200).json({
      success:       true,
      averageRating: lab.averageRating,
      totalReviews:  lab.totalReviews,
      data:          paged,
      pagination: {
        total:      visible.length,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(visible.length / Number(limit)),
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
//  CUSTOMER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/labs/customer/:id/reviews
 * Submit a review for a lab after a completed booking.
 */
router.post(
  '/customer/:id/reviews',
  protect,
  authorize('customer'),
  asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: 'rating must be between 1 and 5.' });
    }

    const lab = await LabPartnerProfile.findOne({
      _id: req.params.id, status: 'approved', isActive: true,
    });
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const alreadyReviewed = lab.reviews.some(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this lab.' });
    }

    lab.reviews.push({
      user:      req.user._id,
      rating:    Number(rating),
      comment:   comment?.trim(),
      isVisible: true,
    });

    await lab.save();

    await invalidateKeys([
      `lab:${lab._id}:public`,
      `GET:/api/labs/public/${lab._id}`,
    ]);

    return res.status(201).json({
      success:       true,
      message:       'Review submitted. Thank you!',
      averageRating: lab.averageRating,
      totalReviews:  lab.totalReviews,
    });
  })
);

/**
 * GET /api/labs/customer/search
 * Customer-facing lab + test search.
 */
router.get(
  '/customer/search',
  protect,
  authorize('customer'),
  asyncHandler(async (req, res) => {
    const { testName, city, lat, lng, radiusKm = 10 } = req.query;

    const filter = { status: 'approved', isActive: true };

    if (testName) {
      filter['labTests'] = {
        $elemMatch: {
          testName: { $regex: testName, $options: 'i' },
          isActive: true,
        },
      };
    }
    if (city) filter['registeredAddress.city'] = { $regex: city, $options: 'i' };
    if (lat && lng) {
      filter['registeredAddress.location'] = {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radiusKm) * 1000,
        },
      };
    }

    const labs = await LabPartnerProfile.find(filter)
      .select(
        'labName labCode labType logoUrl registeredAddress averageRating totalReviews ' +
        'sampleCollectionMode homeCollectionRadius homeCollectionFee labTests isVerified tags'
      )
      .limit(30)
      .lean();

    return res.status(200).json({ success: true, total: labs.length, data: labs });
  })
);

/**
 * GET /api/labs/customer/:id
 * Authenticated customer detail view.
 */
router.get(
  '/customer/:id',
  protect,
  authorize('customer'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findOne({
      _id: req.params.id, status: 'approved', isActive: true,
    })
      .select('-user -complianceDocs -statusLog -createdBy -updatedBy -platformFee')
      .lean({ virtuals: true });

    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    // Strip bankDetails in JS after query — avoids Mongoose path collision
    // caused by bankDetails.accountNumber having select:false in the schema
    delete lab.bankDetails;

    return res.status(200).json({ success: true, data: lab });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
//  LAB PARTNER ROUTES
//  Role: lab partner (the lab user managing their own profile)
// ═════════════════════════════════════════════════════════════════════════════

/** Middleware: ensure the lab partner is accessing only their own lab */
const attachLabProfile = asyncHandler(async (req, res, next) => {
  const lab = await LabPartnerProfile.findOne({ user: req.user._id });
  if (!lab) {
    return res.status(404).json({
      success: false,
      message: 'Lab profile not found for your account. Contact admin.',
    });
  }
  req.lab = lab;
  next();
});

// ── Profile ───────────────────────────────────────────────────────────────────

/**
 * GET /api/labs/partner/me
 * Lab partner views their own full profile.
 */
router.get(
  '/partner/me',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.lab._id)
      .populate('user', 'name email phone isEmailVerified createdAt lastLoginAt')
      .lean({ virtuals: true });

    return res.status(200).json({ success: true, data: lab });
  })
);

/**
 * PATCH /api/labs/partner/me
 * Lab partner updates their own profile.
 */
router.patch(
  '/partner/me',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    const selfUpdatable = [
      'description', 'websiteUrl',
      'avgTurnaroundHours', 'homeCollectionRadius', 'homeCollectionFee',
      'sampleCollectionMode', 'reportDeliveryModes',
    ];
    selfUpdatable.forEach((f) => {
      if (req.body[f] !== undefined) lab[f] = req.body[f];
    });

    if (req.body.timing)         lab.timing         = parseJSON(req.body.timing)         ?? lab.timing;
    if (req.body.contactPersons) lab.contactPersons = parseJSON(req.body.contactPersons) ?? lab.contactPersons;
    if (req.body.tags)           lab.tags           = parseJSON(req.body.tags)           ?? lab.tags;

    if (req.files?.logo?.[0]) {
      lab.logoUrl = await uploadToImageKit(
        req.files.logo[0].buffer, req.files.logo[0].originalname, 'labs/logos'
      );
    }
    if (req.files?.coverImage?.[0]) {
      lab.coverImageUrl = await uploadToImageKit(
        req.files.coverImage[0].buffer, req.files.coverImage[0].originalname, 'labs/covers'
      );
    }

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Profile updated.',
      data:    lab,
    });
  })
);

router.patch(
  '/partner/me/bank-details',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    const {
      accountHolderName, accountNumber, ifscCode,
      bankName, branchName, accountType, upiId,
    } = req.body;

    // Fetch existing bankDetails with the select:false accountNumber field
    const freshLab = await LabPartnerProfile.findById(lab._id)
      .select('+bankDetails.accountNumber');

    const existing = freshLab.bankDetails?.toObject?.() ?? {};

    lab.bankDetails = {
      accountHolderName: accountHolderName ?? existing.accountHolderName,
      accountNumber:     accountNumber     ?? existing.accountNumber,
      ifscCode:          ifscCode          ? ifscCode.toUpperCase() : existing.ifscCode,
      bankName:          bankName          ?? existing.bankName,
      branchName:        branchName        ?? existing.branchName,
      accountType:       accountType       ?? existing.accountType,
      upiId:             upiId             ?? existing.upiId,
      isVerified:        false,
    };

    lab.updatedBy = req.user._id;
    await lab.save();

    return res.status(200).json({
      success: true,
      message: 'Bank details updated. Pending re-verification by admin.',
    });
  })
);
// ── Tests ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/labs/partner/me/tests
 * Lab partner views all their tests.
 */
router.get(
  '/partner/me/tests',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const { isActive, category, search } = req.query;

    let tests = req.lab.labTests;
    if (isActive !== undefined) tests = tests.filter((t) => t.isActive === (isActive === 'true'));
    if (category) tests = tests.filter((t) => t.category?.toLowerCase() === category.toLowerCase());
    if (search)   tests = tests.filter((t) => t.testName?.toLowerCase().includes(search.toLowerCase()));

    return res.status(200).json({
      success: true,
      total:   tests.length,
      data:    tests,
    });
  })
);

/**
 * POST /api/labs/partner/me/tests
 * Lab partner adds a new test (pending admin review flag).
 */
router.post(
  '/partner/me/tests',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  upload.single('reportTemplate'),
  asyncHandler(async (req, res) => {
    const lab = req.lab;

 const { testCode, testName, category, sampleType,
  turnaroundHours, mrpPrice, partnerPrice, discountedPrice, homeCollectionAvailable } = req.body;

    if (!testName || mrpPrice == null) {
      return res.status(400).json({ success: false, message: 'testName and mrpPrice are required.' });
    }

    let reportTemplateUrl;
    if (req.file) {
      reportTemplateUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/report-templates'
      );
    }

    lab.labTests.push({
      testCode, testName, category, sampleType,
      turnaroundHours:        turnaroundHours ? Number(turnaroundHours) : undefined,
      mrpPrice:               Number(mrpPrice),
      partnerPrice:           partnerPrice    ? Number(partnerPrice)    : undefined,
      homeCollectionAvailable: homeCollectionAvailable === 'true',
      discountedPrice: discountedPrice ? Number(discountedPrice) : undefined,
      reportTemplateUrl,
      isActive: true,
    });

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(201).json({
      success: true,
      message: `Test "${testName}" added. It may be reviewed by admin before going live.`,
      data:    lab.labTests[lab.labTests.length - 1],
    });
  })
);

/**
 * PATCH /api/labs/partner/me/tests/:testId
 * Lab partner updates one of their own tests.
 */
router.patch(
  '/partner/me/tests/:testId',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  upload.single('reportTemplate'),
  asyncHandler(async (req, res) => {
    const lab  = req.lab;
    const test = lab.labTests.id(req.params.testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });

    // Partners can update description-level fields; price changes flagged for admin review
    [
     'testCode', 'testName', 'category', 'sampleType',
'turnaroundHours', 'mrpPrice', 'discountedPrice', 'partnerPrice', 'homeCollectionAvailable',
    ].forEach((f) => { if (req.body[f] !== undefined) test[f] = req.body[f]; });

    // Partners can toggle their own tests active/inactive
    if (req.body.isActive !== undefined) test.isActive = req.body.isActive === 'true' || req.body.isActive === true;

    if (req.file) {
      test.reportTemplateUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/report-templates'
      );
    }

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Test updated.', data: test });
  })
);

/**
 * DELETE /api/labs/partner/me/tests/:testId
 * Lab partner soft-deactivates one of their own tests.
 */
router.delete(
  '/partner/me/tests/:testId',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab  = req.lab;
    const test = lab.labTests.id(req.params.testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });

    test.isActive = false;
    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Test deactivated.' });
  })
);

// ── Packages ──────────────────────────────────────────────────────────────────

/**
 * GET /api/labs/partner/me/packages
 * Lab partner views all their packages.
 */
router.get(
  '/partner/me/packages',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const { isActive } = req.query;
    let pkgs = req.lab.labPackages;
    if (isActive !== undefined) pkgs = pkgs.filter((p) => p.isActive === (isActive === 'true'));

    return res.status(200).json({ success: true, total: pkgs.length, data: pkgs });
  })
);

/**
 * POST /api/labs/partner/me/packages
 * Lab partner adds a new package.
 */
router.post(
  '/partner/me/packages',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;
    const { packageCode, packageName, description, tests, mrpPrice, partnerPrice, validUntil } = req.body;

    if (!packageName || mrpPrice == null) {
      return res.status(400).json({ success: false, message: 'packageName and mrpPrice are required.' });
    }

    lab.labPackages.push({
      packageCode,
      packageName,
      description,
      tests:        parseJSON(tests) ?? [],
      mrpPrice:     Number(mrpPrice),
      partnerPrice: partnerPrice ? Number(partnerPrice) : undefined,
      validUntil:   validUntil ? new Date(validUntil) : undefined,
      isActive:     true,
    });

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(201).json({
      success: true,
      message: `Package "${packageName}" added.`,
      data:    lab.labPackages[lab.labPackages.length - 1],
    });
  })
);

/**
 * PATCH /api/labs/partner/me/packages/:pkgId
 * Lab partner updates one of their own packages.
 */
router.patch(
  '/partner/me/packages/:pkgId',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;
    const pkg = lab.labPackages.id(req.params.pkgId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });

    [
      'packageCode', 'packageName', 'description',
      'mrpPrice', 'partnerPrice', 'validUntil', 'isActive',
    ].forEach((f) => { if (req.body[f] !== undefined) pkg[f] = req.body[f]; });

    if (req.body.tests) pkg.tests = parseJSON(req.body.tests) ?? pkg.tests;

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Package updated.', data: pkg });
  })
);

/**
 * DELETE /api/labs/partner/me/packages/:pkgId
 * Lab partner soft-deactivates one of their own packages.
 */
router.delete(
  '/partner/me/packages/:pkgId',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;
    const pkg = lab.labPackages.id(req.params.pkgId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });

    pkg.isActive  = false;
    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Package deactivated.' });
  })
);

// ── Accreditations & Compliance ───────────────────────────────────────────────

/**
 * GET /api/labs/partner/me/accreditations
 * Lab partner views their accreditations + compliance docs.
 */
router.get(
  '/partner/me/accreditations',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success:        true,
      accreditations: req.lab.accreditations,
      complianceDocs: req.lab.complianceDocs,
    });
  })
);

/**
 * POST /api/labs/partner/me/accreditations
 * Lab partner uploads their own accreditation certificate.
 */
router.post(
  '/partner/me/accreditations',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  upload.single('certificate'),
  asyncHandler(async (req, res) => {
    const { body: accBody, certificateNo, issuedOn, validUntil } = req.body;

    if (!accBody) {
      return res.status(400).json({ success: false, message: 'Accreditation body is required.' });
    }

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/accreditations'
      );
    }

    req.lab.accreditations.push({
      body:        accBody,
      certificateNo,
      issuedOn:    issuedOn   ? new Date(issuedOn)   : undefined,
      validUntil:  validUntil ? new Date(validUntil) : undefined,
      documentUrl,
      isVerified:  false,
    });

    req.lab.updatedBy = req.user._id;
    await req.lab.save();
    await invalidateLabCaches(req.lab._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Accreditation submitted for admin verification.',
      data:    req.lab.accreditations[req.lab.accreditations.length - 1],
    });
  })
);

/**
 * POST /api/labs/partner/me/compliance-docs
 * Lab partner uploads their own compliance document.
 */
router.post(
  '/partner/me/compliance-docs',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const { docType, docNumber, issuedOn, validUntil, remarks } = req.body;

    if (!docType) {
      return res.status(400).json({ success: false, message: 'docType is required.' });
    }

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/compliance-docs'
      );
    }

    req.lab.complianceDocs.push({
      docType,
      docNumber,
      issuedOn:   issuedOn   ? new Date(issuedOn)   : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      documentUrl,
      remarks,
      isVerified: false,
    });

    req.lab.updatedBy = req.user._id;
    await req.lab.save();

    return res.status(201).json({
      success: true,
      message: 'Compliance document submitted for admin verification.',
      data:    req.lab.complianceDocs[req.lab.complianceDocs.length - 1],
    });
  })
);

// ── Status & Reviews ──────────────────────────────────────────────────────────

/**
 * GET /api/labs/partner/me/status-log
 * Lab partner views the history of status changes on their account.
 */
router.get(
  '/partner/me/status-log',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success:   true,
      status:    req.lab.status,
      isActive:  req.lab.isActive,
      statusLog: req.lab.statusLog,
    });
  })
);

/**
 * GET /api/labs/partner/me/reviews
 * Lab partner views all reviews on their lab.
 */
router.get(
  '/partner/me/reviews',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.lab._id)
      .populate('reviews.user', 'name avatar')
      .select('labName reviews averageRating totalReviews')
      .lean();

    return res.status(200).json({
      success:       true,
      averageRating: lab.averageRating,
      totalReviews:  lab.totalReviews,
      data:          lab.reviews,
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
//  LAB PARTNER — SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/labs/partner/me/settings
 * Retrieve all configurable settings for the lab partner.
 * Returns operational preferences, notification prefs, display settings.
 */
router.get(
  '/partner/me/settings',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.lab._id)
      .select(
        'labName sampleCollectionMode homeCollectionRadius homeCollectionFee ' +
        'avgTurnaroundHours reportDeliveryModes payoutFrequency timing ' +
        'websiteUrl description tags isFeatured isVerified isActive status ' +
        'settings notificationPreferences'
      )
      .lean();

    // Build a structured settings payload
    const settings = {
      operational: {
        sampleCollectionMode: lab.sampleCollectionMode,
        homeCollectionRadius: lab.homeCollectionRadius,
        homeCollectionFee:    lab.homeCollectionFee,
        avgTurnaroundHours:   lab.avgTurnaroundHours,
        reportDeliveryModes:  lab.reportDeliveryModes,
        payoutFrequency:      lab.payoutFrequency,
        timing:               lab.timing,
      },
      display: {
        websiteUrl:  lab.websiteUrl,
        description: lab.description,
        tags:        lab.tags,
      },
      account: {
        isActive: lab.isActive,
        status:   lab.status,
        isFeatured: lab.isFeatured,
        isVerified: lab.isVerified,
      },
      // Stored on the lab doc as lab.settings (extend schema if not present)
      notifications: lab.notificationPreferences ?? {
        emailOnNewBooking:     true,
        emailOnCancellation:   true,
        emailOnReview:         true,
        emailOnStatusChange:   true,
        smsOnNewBooking:       false,
      },
    };

    return res.status(200).json({ success: true, data: settings });
  })
);

/**
 * PATCH /api/labs/partner/me/settings/operational
 * Update operational settings: collection mode, radius, fee, TAT, report modes, timing.
 */
router.patch(
  '/partner/me/settings/operational',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    const operationalFields = [
      'sampleCollectionMode', 'homeCollectionRadius', 'homeCollectionFee',
      'avgTurnaroundHours', 'payoutFrequency',
    ];
    operationalFields.forEach((f) => {
      if (req.body[f] !== undefined) lab[f] = req.body[f];
    });

    if (req.body.reportDeliveryModes) {
      lab.reportDeliveryModes = parseJSON(req.body.reportDeliveryModes) ?? lab.reportDeliveryModes;
    }
    if (req.body.timing) {
      lab.timing = parseJSON(req.body.timing) ?? lab.timing;
    }

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Operational settings updated.',
      data: {
        sampleCollectionMode: lab.sampleCollectionMode,
        homeCollectionRadius: lab.homeCollectionRadius,
        homeCollectionFee:    lab.homeCollectionFee,
        avgTurnaroundHours:   lab.avgTurnaroundHours,
        reportDeliveryModes:  lab.reportDeliveryModes,
        payoutFrequency:      lab.payoutFrequency,
        timing:               lab.timing,
      },
    });
  })
);

/**
 * PATCH /api/labs/partner/me/settings/display
 * Update display settings: description, website URL, tags.
 */
router.patch(
  '/partner/me/settings/display',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    if (req.body.description !== undefined) lab.description = req.body.description?.trim();
    if (req.body.websiteUrl  !== undefined) lab.websiteUrl  = req.body.websiteUrl?.trim();
    if (req.body.tags)                      lab.tags        = parseJSON(req.body.tags) ?? lab.tags;

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Display settings updated.',
      data: {
        description: lab.description,
        websiteUrl:  lab.websiteUrl,
        tags:        lab.tags,
      },
    });
  })
);

/**
 * PATCH /api/labs/partner/me/settings/notifications
 * Update notification preferences.
 * Body: { emailOnNewBooking, emailOnCancellation, emailOnReview, emailOnStatusChange, smsOnNewBooking }
 * NOTE: Add notificationPreferences field to LabPartnerProfile schema if not present.
 */
router.patch(
  '/partner/me/settings/notifications',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    const allowed = [
      'emailOnNewBooking', 'emailOnCancellation',
      'emailOnReview', 'emailOnStatusChange', 'smsOnNewBooking',
    ];

    // Initialise if not set
    if (!lab.notificationPreferences) {
      lab.notificationPreferences = {};
    }

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        lab.notificationPreferences[key] = Boolean(req.body[key]);
      }
    });

    lab.markModified('notificationPreferences');
    lab.updatedBy = req.user._id;
    await lab.save();

    return res.status(200).json({
      success: true,
      message: 'Notification preferences updated.',
      data:    lab.notificationPreferences,
    });
  })
);

/**
 * PATCH /api/labs/partner/me/settings/contact-persons
 * Update the list of contact persons (Lab Director, Ops Head, etc.).
 * Body: { contactPersons: [...] }
 */
router.patch(
  '/partner/me/settings/contact-persons',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    const contactPersons = parseJSON(req.body.contactPersons);
    if (!Array.isArray(contactPersons)) {
      return res.status(400).json({ success: false, message: 'contactPersons must be an array.' });
    }

    lab.contactPersons = contactPersons;
    lab.updatedBy      = req.user._id;
    await lab.save();

    return res.status(200).json({
      success: true,
      message: 'Contact persons updated.',
      data:    lab.contactPersons,
    });
  })
);

/**
 * PATCH /api/labs/partner/me/settings/timing
 * Update lab operating hours.
 * Body: { timing: [{ day, openTime, closeTime, isClosed }] }
 */
router.patch(
  '/partner/me/settings/timing',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    const timing = parseJSON(req.body.timing);
    if (!Array.isArray(timing)) {
      return res.status(400).json({ success: false, message: 'timing must be an array.' });
    }

    lab.timing    = timing;
    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Timing updated.',
      data:    lab.timing,
    });
  })
);

/**
 * PATCH /api/labs/partner/me/settings/images
 * Update lab logo and cover image.
 */
router.patch(
  '/partner/me/settings/images',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const lab = req.lab;

    if (!req.files?.logo?.[0] && !req.files?.coverImage?.[0]) {
      return res.status(400).json({ success: false, message: 'At least one image file is required.' });
    }

    if (req.files?.logo?.[0]) {
      lab.logoUrl = await uploadToImageKit(
        req.files.logo[0].buffer, req.files.logo[0].originalname, 'labs/logos'
      );
    }
    if (req.files?.coverImage?.[0]) {
      lab.coverImageUrl = await uploadToImageKit(
        req.files.coverImage[0].buffer, req.files.coverImage[0].originalname, 'labs/covers'
      );
    }

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Images updated.',
      data: {
        logoUrl:      lab.logoUrl,
        coverImageUrl: lab.coverImageUrl,
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
//  LAB PARTNER — SECURITY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * PATCH /api/labs/partner/me/change-password
 * Lab partner changes their own account password.
 */
router.patch(
  '/partner/me/change-password',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required.',
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'newPassword must be at least 8 characters.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password          = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    // Send security alert email
    try {
      await sendEmail({
        email:   user.email,
        subject: '🔒 Password Changed — Likeson Healthcare',
        html:    buildSecurityAlertEmail({
          name:       user.name,
          action:     'Your account password was successfully changed. If you did not make this change, please contact support immediately.',
          ipAddress:  req.ip,
          deviceInfo: req.headers['user-agent'],
          timestamp:  new Date().toLocaleString('en-IN'),
        }),
      });
    } catch (err) {
      console.error('[Lab Change Password] Email failed:', err.message);
    }

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Lab partner "${user.name}" changed their password`,
      actor:    { userId: user._id, name: user.name, role: user.role, ip: req.ip },
      request:  { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
    });

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  })
);

/**
 * POST /api/labs/partner/me/security/request-email-change
 * Lab partner requests email change — sends OTP to current email for verification.
 * Body: { newEmail }
 */
router.post(
  '/partner/me/security/request-email-change',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const { newEmail } = req.body;

    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid newEmail is required.' });
    }

    const emailTaken = await User.findOne({ email: newEmail.toLowerCase().trim() });
    if (emailTaken) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }

    const user = await User.findById(req.user._id);
    const otp  = generateOTP();
    user.otp        = await bcrypt.hash(otp, 10);
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    try {
      await sendEmail({
        email:   user.email,
        subject: '🔐 Verify Email Change — Likeson Healthcare',
        html:    buildSecurityAlertEmail({
          name:      user.name,
          action:    `You requested to change your email address to <strong>${newEmail}</strong>. Use the OTP below to confirm this change. If this was not you, please ignore this email and secure your account.`,
          otp,
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent'],
          timestamp:  new Date().toLocaleString('en-IN'),
        }),
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }

    return res.status(200).json({
      success: true,
      message: `OTP sent to your current email ${user.email}. Use it to confirm the email change.`,
    });
  })
);

/**
 * PATCH /api/labs/partner/me/security/confirm-email-change
 * Confirm the email change with OTP.
 * Body: { newEmail, otp }
 */
router.patch(
  '/partner/me/security/confirm-email-change',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const { newEmail, otp } = req.body;

    if (!newEmail || !otp) {
      return res.status(400).json({ success: false, message: 'newEmail and otp are required.' });
    }

    const user = await User.findById(req.user._id).select('+otp +otpExpires');
    if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const otpMatch = await bcrypt.compare(otp, user.otp);
    if (!otpMatch) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    const emailTaken = await User.findOne({ email: newEmail.toLowerCase().trim() });
    if (emailTaken) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }

    const oldEmail  = user.email;
    user.email      = newEmail.toLowerCase().trim();
    user.otp        = undefined;
    user.otpExpires = undefined;
    user.isEmailVerified = false; // require re-verification
    await user.save();

    try {
      await sendEmail({
        email:   oldEmail,
        subject: '✅ Email Changed — Likeson Healthcare',
        html:    buildSecurityAlertEmail({
          name:      user.name,
          action:    `Your account email has been changed to <strong>${newEmail}</strong>. If you did not make this change, contact support immediately.`,
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent'],
          timestamp:  new Date().toLocaleString('en-IN'),
        }),
      });
    } catch (err) {
      console.error('[Lab Email Change] Notification email failed:', err.message);
    }

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Lab partner email changed from ${oldEmail} to ${newEmail}`,
      actor:    { userId: user._id, name: user.name, role: user.role, ip: req.ip },
      request:  { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      metadata: { oldEmail, newEmail },
    });

    return res.status(200).json({
      success: true,
      message: 'Email changed successfully. Please verify your new email.',
    });
  })
);

/**
 * GET /api/labs/partner/me/security/sessions
 * View all active sessions for the lab partner account.
 */
router.get(
  '/partner/me/security/sessions',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions');

    return res.status(200).json({
      success:        true,
      currentSession: req.user.sessionId,
      data:           user.auditSessions ?? [],
    });
  })
);

/**
 * DELETE /api/labs/partner/me/security/sessions/:sessionId
 * Revoke a specific session (force logout on that device).
 */
router.delete(
  '/partner/me/security/sessions/:sessionId',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const user = await User.findById(req.user._id).select('auditSessions deviceTokens');

    const session = (user.auditSessions ?? []).find(
      (s) => s._id.toString() === sessionId
    );
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    // Remove associated device token if any
    if (session.deviceTokenId) {
      user.deviceTokens = user.deviceTokens.filter(
        (t) => t._id.toString() !== session.deviceTokenId.toString()
      );
    }

    user.auditSessions = user.auditSessions.filter(
      (s) => s._id.toString() !== sessionId
    );

    await user.save();

    await SystemLog.createLog({
      level:    'info',
      category: 'security',
      message:  `Lab partner "${user.name}" revoked session ${sessionId}`,
      actor:    { userId: user._id, name: user.name, role: user.role, ip: req.ip },
      request:  { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
    });

    return res.status(200).json({ success: true, message: 'Session revoked.' });
  })
);

/**
 * DELETE /api/labs/partner/me/security/sessions
 * Revoke ALL sessions except the current one (global logout from other devices).
 */
router.delete(
  '/partner/me/security/sessions',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions deviceTokens');

    const currentSessionId = req.user.sessionId;

    // Keep only current session; remove device tokens of revoked sessions
    const revokedSessions = (user.auditSessions ?? []).filter(
      (s) => s._id.toString() !== currentSessionId
    );
    const revokedTokenIds = revokedSessions
      .map((s) => s.deviceTokenId?.toString())
      .filter(Boolean);

    user.auditSessions = (user.auditSessions ?? []).filter(
      (s) => s._id.toString() === currentSessionId
    );
    user.deviceTokens  = (user.deviceTokens ?? []).filter(
      (t) => !revokedTokenIds.includes(t._id.toString())
    );

    await user.save();

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Lab partner "${user.name}" revoked all other sessions`,
      actor:    { userId: user._id, name: user.name, role: user.role, ip: req.ip },
      request:  { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
    });

    return res.status(200).json({
      success: true,
      message: `All other sessions revoked. ${revokedSessions.length} device(s) logged out.`,
    });
  })
);

/**
 * GET /api/labs/partner/me/security/login-history
 * View recent login history (last 20 audit sessions).
 */
router.get(
  '/partner/me/security/login-history',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select('auditSessions lastLoginAt lastLoginIp loginCount');

    const sessions = (user.auditSessions ?? [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    return res.status(200).json({
      success: true,
      data: {
        lastLoginAt:  user.lastLoginAt,
        lastLoginIp:  user.lastLoginIp,
        loginCount:   user.loginCount,
        recentSessions: sessions,
      },
    });
  })
);

/**
 * POST /api/labs/partner/me/security/send-verification-otp
 * Send email verification OTP to the lab partner's current email.
 */
router.post(
  '/partner/me/security/send-verification-otp',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified.' });
    }

    const otp       = generateOTP();
    user.otp        = await bcrypt.hash(otp, 10);
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await sendEmail({
        email:   user.email,
        subject: '📧 Verify Your Email — Likeson Healthcare',
        html:    buildSecurityAlertEmail({
          name:      user.name,
          action:    'Please use the code below to verify your email address on Likeson Healthcare.',
          otp,
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent'],
          timestamp:  new Date().toLocaleString('en-IN'),
        }),
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
    }

    return res.status(200).json({ success: true, message: 'Verification OTP sent to your email.' });
  })
);

/**
 * POST /api/labs/partner/me/security/verify-email
 * Verify email with OTP.
 * Body: { otp }
 */
router.post(
  '/partner/me/security/verify-email',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'otp is required.' });

    const user = await User.findById(req.user._id).select('+otp +otpExpires');

    if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
    }

    const valid = await bcrypt.compare(otp, user.otp);
    if (!valid) return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    user.isEmailVerified = true;
    user.otp             = undefined;
    user.otpExpires      = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: 'Email verified successfully.' });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
//  LAB PARTNER — NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/labs/partner/me/notifications
 * Fetch paginated notifications for the lab partner.
 * Query: page, limit, isRead, type
 */
router.get(
  '/partner/me/notifications',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const {
      page   = 1,
      limit  = 20,
      isRead,
      type,
    } = req.query;

    const filter = { recipient: req.user._id };
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (type)                  filter.type  = type;

    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  })
);

/**
 * PATCH /api/labs/partner/me/notifications/:notificationId/read
 * Mark a single notification as read.
 */
router.patch(
  '/partner/me/notifications/:notificationId/read',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.status(200).json({ success: true, message: 'Notification marked as read.', data: notification });
  })
);

/**
 * PATCH /api/labs/partner/me/notifications/read-all
 * Mark all notifications as read.
 */
router.patch(
  '/partner/me/notifications/read-all',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read.`,
    });
  })
);

/**
 * DELETE /api/labs/partner/me/notifications/:notificationId
 * Delete a single notification.
 */
router.delete(
  '/partner/me/notifications/:notificationId',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndDelete({
      _id:       req.params.notificationId,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.status(200).json({ success: true, message: 'Notification deleted.' });
  })
);

/**
 * DELETE /api/labs/partner/me/notifications
 * Clear all notifications (or all read ones).
 * Query: ?readOnly=true — only deletes read notifications.
 */
router.delete(
  '/partner/me/notifications',
  protect,
  authorize('lab partner'),
  asyncHandler(async (req, res) => {
    const filter = { recipient: req.user._id };
    if (req.query.readOnly === 'true') filter.isRead = true;

    const result = await Notification.deleteMany(filter);

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} notification(s) deleted.`,
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
//  LAB PARTNER — DASHBOARD & ANALYTICS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/labs/partner/me/dashboard
 * High-level dashboard stats for the lab partner.
 * Returns counts of active tests, packages, recent reviews, account status.
 */
router.get(
  '/partner/me/dashboard',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  cache(30, (req) => `lab:${req.lab._id}:dashboard`),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.lab._id)
      .select(
        'labName status isActive isVerified isFeatured averageRating totalReviews ' +
        'labTests labPackages accreditations complianceDocs reviews createdAt'
      )
      .lean({ virtuals: true });

    const activeTests    = lab.labTests.filter((t) => t.isActive).length;
    const inactiveTests  = lab.labTests.length - activeTests;
    const activePackages = lab.labPackages.filter((p) => p.isActive).length;

    const pendingDocs = [
      ...lab.accreditations.filter((a) => !a.isVerified),
      ...lab.complianceDocs.filter((d) => !d.isVerified),
    ].length;

    const recentReviews = lab.reviews
      .filter((r) => r.isVisible)
      .slice(-5)
      .reverse();

    return res.status(200).json({
      success: true,
      data: {
        labName:      lab.labName,
        status:       lab.status,
        isActive:     lab.isActive,
        isVerified:   lab.isVerified,
        isFeatured:   lab.isFeatured,
        memberSince:  lab.createdAt,
        rating: {
          average: lab.averageRating,
          total:   lab.totalReviews,
        },
        tests: {
          total:    lab.labTests.length,
          active:   activeTests,
          inactive: inactiveTests,
        },
        packages: {
          total:  lab.labPackages.length,
          active: activePackages,
        },
        documents: {
          pending: pendingDocs,
          accreditations: lab.accreditations.length,
          complianceDocs: lab.complianceDocs.length,
        },
        recentReviews,
      },
    });
  })
);

/**
 * GET /api/labs/partner/me/analytics/reviews
 * Review analytics — rating breakdown, trend over last 6 months.
 */
router.get(
  '/partner/me/analytics/reviews',
  protect,
  authorize('lab partner'),
  attachLabProfile,
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.lab._id)
      .select('reviews averageRating totalReviews')
      .lean();

    const visible = lab.reviews.filter((r) => r.isVisible);

    // Rating distribution 1–5
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    visible.forEach((r) => { distribution[Math.round(r.rating)]++; });

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthly = {};
    visible
      .filter((r) => new Date(r.createdAt) >= sixMonthsAgo)
      .forEach((r) => {
        const key = new Date(r.createdAt).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
        if (!monthly[key]) monthly[key] = { count: 0, total: 0 };
        monthly[key].count++;
        monthly[key].total += r.rating;
      });

    const trend = Object.entries(monthly).map(([month, val]) => ({
      month,
      count:         val.count,
      averageRating: +(val.total / val.count).toFixed(2),
    }));

    return res.status(200).json({
      success: true,
      data: {
        averageRating: lab.averageRating,
        totalReviews:  lab.totalReviews,
        distribution,
        trend,
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
//  Role: admin | superadmin
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/labs/admin
 * Create a new lab partner: User account + LabPartnerProfile in one shot.
 */
router.post(
  '/admin',
  protect,
  authorize('admin', 'superadmin'),
  upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const {
      name, email, phone,
      labName, labType, ownershipType, description, websiteUrl,
      registrationNumber, gstin, panNumber, establishedYear,
      sampleCollectionMode, homeCollectionRadius, homeCollectionFee,
      avgTurnaroundHours, payoutFrequency,
      platformFeeType, platformFeeValue,
    } = req.body;

    if (!name || !email || !labName || !labType || !ownershipType) {
      return res.status(400).json({
        success: false,
        message: 'name, email, labName, labType, and ownershipType are required.',
      });
    }

    const parsedAddress = parseJSON(req.body.registeredAddress);
    if (
      !parsedAddress?.line1 || !parsedAddress?.city ||
      !parsedAddress?.state || !parsedAddress?.pincode
    ) {
      return res.status(400).json({
        success: false,
        message: 'registeredAddress must include line1, city, state, pincode.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const plainPassword  = generatePassword(12);
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    let logoUrl, coverImageUrl;
    if (req.files?.logo?.[0]) {
      logoUrl = await uploadToImageKit(
        req.files.logo[0].buffer, req.files.logo[0].originalname, 'labs/logos'
      );
    }
    if (req.files?.coverImage?.[0]) {
      coverImageUrl = await uploadToImageKit(
        req.files.coverImage[0].buffer, req.files.coverImage[0].originalname, 'labs/covers'
      );
    }

    const user = await User.create({
      name:            name.trim(),
      email:           email.toLowerCase().trim(),
      phone:           phone?.trim(),
      password:        hashedPassword,
      role:            'lab partner',
      isEmailVerified: true,
      createdBy:       req.user._id,
    });

    let platformFee = null;
    if (platformFeeType && platformFeeValue != null) {
      platformFee = { type: platformFeeType, value: Number(platformFeeValue) };
    }

    const lab = await LabPartnerProfile.create({
      user:               user._id,
      labName:            labName.trim(),
      labType,
      ownershipType,
      description:        description?.trim(),
      websiteUrl:         websiteUrl?.trim(),
      logoUrl,
      coverImageUrl,
      registrationNumber: registrationNumber?.trim(),
      gstin:              gstin?.toUpperCase().trim(),
      panNumber:          panNumber?.toUpperCase().trim(),
      establishedYear:    establishedYear ? Number(establishedYear) : undefined,
      registeredAddress:  parsedAddress,
      sampleCollectionMode: sampleCollectionMode || 'Both',
      homeCollectionRadius: homeCollectionRadius ? Number(homeCollectionRadius) : 0,
      homeCollectionFee:    homeCollectionFee    ? Number(homeCollectionFee)    : 0,
      avgTurnaroundHours:   avgTurnaroundHours   ? Number(avgTurnaroundHours)   : undefined,
      payoutFrequency:      payoutFrequency       || 'Monthly',
      platformFee,
      contactPersons:  parseJSON(req.body.contactPersons)  ?? [],
      accreditations:  parseJSON(req.body.accreditations)  ?? [],
      reportDeliveryModes: parseJSON(req.body.reportDeliveryModes) ?? [],
      timing:          parseJSON(req.body.timing)           ?? [],
      tags:            parseJSON(req.body.tags)             ?? [],
      status:   'pending',
      isActive: false,
      createdBy: req.user._id,
    });

    try {
      await sendEmail({
        email:   user.email,
        subject: `Welcome to Likeson Healthcare — Your Lab Partner Account`,
        html:    buildLabWelcomeEmail({
          labName:  lab.labName,
          name:     user.name,
          email:    user.email,
          password: plainPassword,
        }),
      });
    } catch (emailErr) {
      console.error('[Lab Create] Welcome email failed:', emailErr.message);
    }

    await SystemLog.createLog({
      level:    'success',
      category: 'user',
      message:  `Lab partner "${lab.labName}" created by ${req.user.role}`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'User', entityId: user._id, label: lab.labName },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 201 },
    });

    await invalidatePattern('GET:/api/labs*');

    return res.status(201).json({
      success: true,
      message: `Lab "${lab.labName}" created. Credentials sent to ${user.email}.`,
      data:    { lab, userId: user._id },
    });
  })
);

/**
 * GET /api/labs/admin
 * List all labs with pagination, search, filters.
 */
router.get(
  '/admin',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const {
      page = 1, limit = 20,
      status, labType, search, isActive,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const filter = {};
    if (status)   filter.status  = status;
    if (labType)  filter.labType = labType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { labName:  { $regex: search, $options: 'i' } },
        { labCode:  { $regex: search, $options: 'i' } },
        { 'registeredAddress.city': { $regex: search, $options: 'i' } },
        { tags:     { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [labs, total] = await Promise.all([
      LabPartnerProfile.find(filter)
        .populate('user', 'name email phone isBlocked createdAt lastLoginAt')
        .select(
          '-labTests -labPackages -reviews -complianceDocs -accreditations ' +
          '-statusLog -branches'
        )
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      LabPartnerProfile.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: labs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  })
);

/**
 * GET /api/labs/admin/:id
 * Full lab detail for admin.
 */
router.get(
  '/admin/:id',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id)
      .populate('user',       'name email phone isBlocked createdAt lastLoginAt')
      .populate('approvedBy', 'name email role')
      .populate('createdBy',  'name email role')
      .lean({ virtuals: true });

    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    return res.status(200).json({ success: true, data: lab });
  })
);

/**
 * PATCH /api/labs/admin/:id
 * Admin updates any lab field.
 */
router.patch(
  '/admin/:id',
  protect,
  authorize('admin', 'superadmin'),
  upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const adminUpdatable = [
      'labName', 'labType', 'ownershipType', 'description', 'websiteUrl',
      'registrationNumber', 'gstin', 'panNumber', 'establishedYear',
      'sampleCollectionMode', 'homeCollectionRadius', 'homeCollectionFee',
      'avgTurnaroundHours', 'payoutFrequency',
      'isFeatured', 'isVerified', 'isActive',
    ];
    adminUpdatable.forEach((f) => {
      if (req.body[f] !== undefined) lab[f] = req.body[f];
    });

    if (req.body.registeredAddress)   lab.registeredAddress   = parseJSON(req.body.registeredAddress)   ?? lab.registeredAddress;
    if (req.body.reportDeliveryModes) lab.reportDeliveryModes = parseJSON(req.body.reportDeliveryModes) ?? lab.reportDeliveryModes;
    if (req.body.contactPersons)      lab.contactPersons      = parseJSON(req.body.contactPersons)      ?? lab.contactPersons;
    if (req.body.timing)              lab.timing              = parseJSON(req.body.timing)              ?? lab.timing;
    if (req.body.tags)                lab.tags                = parseJSON(req.body.tags)                ?? lab.tags;

    if (req.files?.logo?.[0]) {
      lab.logoUrl = await uploadToImageKit(
        req.files.logo[0].buffer, req.files.logo[0].originalname, 'labs/logos'
      );
    }
    if (req.files?.coverImage?.[0]) {
      lab.coverImageUrl = await uploadToImageKit(
        req.files.coverImage[0].buffer, req.files.coverImage[0].originalname, 'labs/covers'
      );
    }

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Lab updated.', data: lab });
  })
);

/**
 * PATCH /api/labs/admin/:id/status
 * Change lab status (approve/suspend/reject/reactivate/deactivate/under_review).
 */
router.patch(
  '/admin/:id/status',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const { action, reason } = req.body;

    const validActions = ['approve', 'suspend', 'reject', 'reactivate', 'deactivate', 'under_review'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `action must be one of: ${validActions.join(', ')}.`,
      });
    }

    if (['suspend', 'reject'].includes(action) && !reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: `reason is required for "${action}".`,
      });
    }

    if (action === 'approve' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superadmin can approve a lab partner.',
      });
    }

    const lab = await LabPartnerProfile.findById(req.params.id)
      .populate('user', 'name email');
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const fromStatus = lab.status;

    switch (action) {
      case 'under_review':
        lab.status = 'under_review';
        break;

      case 'approve':
        lab.status           = 'approved';
        lab.isActive         = true;
        lab.approvedBy       = req.user._id;
        lab.approvedAt       = new Date();
        lab.rejectionReason  = undefined;
        lab.suspensionReason = undefined;
        break;

      case 'suspend':
        lab.status           = 'suspended';
        lab.isActive         = false;
        lab.suspensionReason = reason.trim();
        await User.findByIdAndUpdate(lab.user._id, {
          isBlocked:   true,
          blockReason: `Lab suspended: ${reason.trim()}`,
        });
        break;

      case 'reject':
        lab.status          = 'rejected';
        lab.isActive        = false;
        lab.rejectionReason = reason.trim();
        break;

      case 'reactivate':
        lab.status           = 'approved';
        lab.isActive         = true;
        lab.suspensionReason = undefined;
        await User.findByIdAndUpdate(lab.user._id, {
          isBlocked:   false,
          blockReason: undefined,
          unblockAt:   undefined,
        });
        break;

      case 'deactivate':
        lab.status   = 'deactivated';
        lab.isActive = false;
        break;
    }

    lab.statusLog.push({
      fromStatus,
      toStatus:  lab.status,
      changedBy: req.user._id,
      reason:    reason?.trim(),
      changedAt: new Date(),
    });
    lab.updatedBy = req.user._id;
    await lab.save();

    const emailMessages = {
      under_review: {
        subject: '🔍 Your Lab Application is Under Review',
        body:    'Our team is reviewing your lab partner application. You will hear from us shortly.',
      },
      approve: {
        subject: '✅ Your Lab Partner Account Has Been Approved',
        body:    'Congratulations! Your lab is now live on Likeson Healthcare.',
      },
      suspend: {
        subject: '⚠️ Your Lab Partner Account Has Been Suspended',
        body:    `Your lab has been temporarily suspended. Reason: <strong>${reason}</strong>. Contact support@likeson.in to resolve this.`,
      },
      reject: {
        subject: '❌ Your Lab Partner Application Was Rejected',
        body:    `Your application has been rejected. Reason: <strong>${reason}</strong>. Contact support@likeson.in for more information.`,
      },
      reactivate: {
        subject: '🎉 Your Lab Partner Account Has Been Reactivated',
        body:    'Your lab account is now active again. Welcome back!',
      },
      deactivate: {
        subject: 'ℹ️ Your Lab Partner Account Has Been Deactivated',
        body:    'Your lab account has been deactivated. Please contact support@likeson.in.',
      },
    };

    try {
      const { subject, body } = emailMessages[action];
      await sendEmail({
        email:   lab.user.email,
        subject,
        html:    buildStatusEmail(subject, body),
      });
    } catch (err) {
      console.error('[Lab Status Email] Failed:', err.message);
    }

    // Create in-app notification for the lab partner
    try {
      await Notification.create({
        recipient:   lab.user._id,
        title:       emailMessages[action].subject.replace(/^[^\s]+\s/, ''),
        body:        emailMessages[action].body.replace(/<[^>]+>/g, ''),
        type:        'Account_Status',
        priority:    ['suspend', 'reject'].includes(action) ? 'High' : 'Medium',
        triggeredBy: 'admin',
        createdBy:   req.user._id,
      });
    } catch (err) {
      console.error('[Lab Status Notification] Failed:', err.message);
    }

    await SystemLog.createLog({
      level:    ['approve', 'reactivate'].includes(action) ? 'success' : 'warning',
      category: 'user',
      message:  `Lab "${lab.labName}" ${action}d by ${req.user.role}`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'User', entityId: lab.user._id, label: lab.labName },
      request:  { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      metadata: { fromStatus, toStatus: lab.status, reason },
    });

    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: `Lab "${lab.labName}" ${action}d successfully.`,
      data:    { status: lab.status, isActive: lab.isActive },
    });
  })
);

/**
 * PATCH /api/labs/admin/:id/platform-fee
 * Set a lab-level platform fee override.
 */
router.patch(
  '/admin/:id/platform-fee',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const { type, value } = req.body;

    if (!['fixed', 'percentage'].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'fixed' or 'percentage'." });
    }
    if (value == null || Number(value) < 0) {
      return res.status(400).json({ success: false, message: 'value must be a non-negative number.' });
    }

    const lab = await LabPartnerProfile.findByIdAndUpdate(
      req.params.id,
      { platformFee: { type, value: Number(value) }, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: `Platform fee override set: ${type} ${value}.`,
      data:    { platformFee: lab.platformFee },
    });
  })
);

/**
 * DELETE /api/labs/admin/:id/platform-fee
 * Remove lab-level fee override → falls back to global config.
 */
router.delete(
  '/admin/:id/platform-fee',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findByIdAndUpdate(
      req.params.id,
      { $unset: { platformFee: '' }, updatedBy: req.user._id },
      { new: true }
    );
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Lab-level platform fee removed. Global config will be used.',
    });
  })
);

// ── Tests (Admin) ─────────────────────────────────────────────────────────────

/**
 * POST /api/labs/admin/:id/tests
 */
router.post(
  '/admin/:id/tests',
  protect,
  authorize('admin', 'superadmin'),
  upload.single('reportTemplate'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const {
      testCode, testName, category, sampleType,
      turnaroundHours, mrpPrice, partnerPrice, homeCollectionAvailable,
    } = req.body;

    if (!testName || mrpPrice == null) {
      return res.status(400).json({ success: false, message: 'testName and mrpPrice are required.' });
    }

    let reportTemplateUrl;
    if (req.file) {
      reportTemplateUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/report-templates'
      );
    }

    lab.labTests.push({
      testCode, testName, category, sampleType,
      turnaroundHours:        turnaroundHours ? Number(turnaroundHours) : undefined,
      mrpPrice:               Number(mrpPrice),
      partnerPrice:           partnerPrice    ? Number(partnerPrice)    : undefined,
      homeCollectionAvailable: homeCollectionAvailable === 'true',
      reportTemplateUrl,
      isActive: true,
    });

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(201).json({
      success: true,
      message: `Test "${testName}" added.`,
      data:    lab.labTests[lab.labTests.length - 1],
    });
  })
);

/**
 * PATCH /api/labs/admin/:id/tests/:testId
 */
router.patch(
  '/admin/:id/tests/:testId',
  protect,
  authorize('admin', 'superadmin'),
  upload.single('reportTemplate'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const test = lab.labTests.id(req.params.testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });

    [
      'testCode', 'testName', 'category', 'sampleType',
      'turnaroundHours', 'mrpPrice', 'partnerPrice',
      'homeCollectionAvailable', 'isActive',
    ].forEach((f) => { if (req.body[f] !== undefined) test[f] = req.body[f]; });

    if (req.file) {
      test.reportTemplateUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/report-templates'
      );
    }

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Test updated.', data: test });
  })
);

/**
 * DELETE /api/labs/admin/:id/tests/:testId  (soft delete)
 */
router.delete(
  '/admin/:id/tests/:testId',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const test = lab.labTests.id(req.params.testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });

    test.isActive = false;
    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Test deactivated.' });
  })
);

// ── Packages (Admin) ──────────────────────────────────────────────────────────

/**
 * POST /api/labs/admin/:id/packages
 */
router.post(
  '/admin/:id/packages',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const { packageCode, packageName, description, tests, mrpPrice, partnerPrice, validUntil } = req.body;

    if (!packageName || mrpPrice == null) {
      return res.status(400).json({ success: false, message: 'packageName and mrpPrice are required.' });
    }

    lab.labPackages.push({
      packageCode,
      packageName,
      description,
      tests:        parseJSON(tests) ?? [],
      mrpPrice:     Number(mrpPrice),
      partnerPrice: partnerPrice ? Number(partnerPrice) : undefined,
      validUntil:   validUntil ? new Date(validUntil) : undefined,
      isActive:     true,
    });

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(201).json({
      success: true,
      message: `Package "${packageName}" added.`,
      data:    lab.labPackages[lab.labPackages.length - 1],
    });
  })
);

/**
 * PATCH /api/labs/admin/:id/packages/:pkgId
 */
router.patch(
  '/admin/:id/packages/:pkgId',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const pkg = lab.labPackages.id(req.params.pkgId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });

    [
      'packageCode', 'packageName', 'description',
      'mrpPrice', 'partnerPrice', 'validUntil', 'isActive',
    ].forEach((f) => { if (req.body[f] !== undefined) pkg[f] = req.body[f]; });

    if (req.body.tests) pkg.tests = parseJSON(req.body.tests) ?? pkg.tests;

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Package updated.', data: pkg });
  })
);

/**
 * DELETE /api/labs/admin/:id/packages/:pkgId  (soft delete)
 */
router.delete(
  '/admin/:id/packages/:pkgId',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const pkg = lab.labPackages.id(req.params.pkgId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });

    pkg.isActive  = false;
    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Package deactivated.' });
  })
);

// ── Accreditations (Admin) ────────────────────────────────────────────────────

/**
 * POST /api/labs/admin/:id/accreditations
 */
router.post(
  '/admin/:id/accreditations',
  protect,
  authorize('admin', 'superadmin'),
  upload.single('certificate'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const { body: accBody, certificateNo, issuedOn, validUntil } = req.body;
    if (!accBody) return res.status(400).json({ success: false, message: 'Accreditation body is required.' });

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/accreditations'
      );
    }

    lab.accreditations.push({
      body:          accBody,
      certificateNo,
      issuedOn:    issuedOn   ? new Date(issuedOn)   : undefined,
      validUntil:  validUntil ? new Date(validUntil) : undefined,
      documentUrl,
      isVerified:  false,
    });

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(201).json({
      success: true,
      message: `Accreditation "${accBody}" added.`,
      data:    lab.accreditations[lab.accreditations.length - 1],
    });
  })
);

// ── Compliance Docs (Admin) ───────────────────────────────────────────────────

/**
 * POST /api/labs/admin/:id/compliance-docs
 */
router.post(
  '/admin/:id/compliance-docs',
  protect,
  authorize('admin', 'superadmin'),
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const { docType, docNumber, issuedOn, validUntil, remarks } = req.body;
    if (!docType) return res.status(400).json({ success: false, message: 'docType is required.' });

    let documentUrl;
    if (req.file) {
      documentUrl = await uploadToImageKit(
        req.file.buffer, req.file.originalname, 'labs/compliance-docs'
      );
    }

    lab.complianceDocs.push({
      docType, docNumber, remarks,
      issuedOn:   issuedOn   ? new Date(issuedOn)   : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      documentUrl,
      isVerified: false,
    });

    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(201).json({
      success: true,
      message: `Compliance doc "${docType}" added.`,
      data:    lab.complianceDocs[lab.complianceDocs.length - 1],
    });
  })
);

/**
 * POST /api/labs/admin/:id/verify-doc/:docId
 * Mark a compliance doc or accreditation as verified.
 */
router.post(
  '/admin/:id/verify-doc/:docId',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const { docCollection = 'complianceDocs' } = req.body;

    if (!['complianceDocs', 'accreditations'].includes(docCollection)) {
      return res.status(400).json({
        success: false,
        message: "docCollection must be 'complianceDocs' or 'accreditations'.",
      });
    }

    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const doc = lab[docCollection].id(req.params.docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    doc.isVerified = true;
    doc.verifiedBy = req.user._id;
    doc.verifiedAt = new Date();
    lab.updatedBy  = req.user._id;

    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Document verified.', data: doc });
  })
);

/**
 * PATCH /api/labs/admin/:id/verify-bank
 * Admin verifies the lab's bank details.
 */
router.patch(
  '/admin/:id/verify-bank',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    if (!lab.bankDetails) {
      return res.status(400).json({ success: false, message: 'No bank details to verify.' });
    }

    lab.bankDetails.isVerified = true;
    lab.bankDetails.verifiedBy = req.user._id;
    lab.bankDetails.verifiedAt = new Date();
    lab.updatedBy              = req.user._id;

    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Bank details verified.' });
  })
);

// ── Reviews (Admin) ───────────────────────────────────────────────────────────

/**
 * GET /api/labs/admin/:id/reviews
 * All reviews including hidden ones.
 */
router.get(
  '/admin/:id/reviews',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id)
      .populate('reviews.user', 'name email avatar')
      .select('labName reviews averageRating totalReviews')
      .lean();

    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    return res.status(200).json({ success: true, data: lab });
  })
);

/**
 * PATCH /api/labs/admin/:id/reviews/:reviewId
 * Toggle review visibility.
 */
router.patch(
  '/admin/:id/reviews/:reviewId',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const review = lab.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    review.isVisible = !review.isVisible;
    lab.updatedBy    = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({
      success:       true,
      message:       `Review ${review.isVisible ? 'shown' : 'hidden'}.`,
      data:          { isVisible: review.isVisible, averageRating: lab.averageRating },
    });
  })
);

/**
 * DELETE /api/labs/admin/:id/reviews/:reviewId
 * Hard delete a review.
 */
router.delete(
  '/admin/:id/reviews/:reviewId',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const review = lab.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    review.deleteOne();
    lab.updatedBy = req.user._id;
    await lab.save();
    await invalidateLabCaches(lab._id.toString());

    return res.status(200).json({ success: true, message: 'Review deleted.' });
  })
);

/**
 * PATCH /api/labs/admin/:id/resend-credentials
 * Re-generate and re-send login credentials. Superadmin only.
 */
router.patch(
  '/admin/:id/resend-credentials',
  protect,
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const lab = await LabPartnerProfile.findById(req.params.id).populate('user', 'name email');
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    const plainPassword  = generatePassword(12);
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    await User.findByIdAndUpdate(lab.user._id, {
      password:          hashedPassword,
      passwordChangedAt: new Date(),
    });

    try {
      await sendEmail({
        email:   lab.user.email,
        subject: '🔑 Your Likeson Lab Partner Login Credentials (Reset)',
        html:    buildLabWelcomeEmail({
          labName:  lab.labName,
          name:     lab.user.name,
          email:    lab.user.email,
          password: plainPassword,
        }),
      });
    } catch (emailErr) {
      return res.status(500).json({
        success: false,
        message: `Password reset but email delivery failed: ${emailErr.message}`,
      });
    }

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Lab "${lab.labName}" credentials reset by superadmin`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'User', entityId: lab.user._id, label: lab.labName },
      request:  { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
    });

    return res.status(200).json({
      success: true,
      message: `New credentials sent to ${lab.user.email}.`,
    });
  })
);

/**
 * POST /api/labs/admin/:id/send-notification
 * Admin pushes an in-app + email notification to a lab partner.
 * Body: { title, body, type?, priority?, sendEmail? }
 */
router.post(
  '/admin/:id/send-notification',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const { title, body: msgBody, type = 'Admin_Announcement', priority = 'Medium', sendEmail: doEmail } = req.body;

    if (!title || !msgBody) {
      return res.status(400).json({ success: false, message: 'title and body are required.' });
    }

    const lab = await LabPartnerProfile.findById(req.params.id).populate('user', 'name email');
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found.' });

    await Notification.create({
      recipient:   lab.user._id,
      title,
      body:        msgBody,
      type,
      priority,
      triggeredBy: 'admin',
      createdBy:   req.user._id,
    });

    if (doEmail === true || doEmail === 'true') {
      try {
        await sendEmail({
          email:   lab.user.email,
          subject: title,
          html:    buildStatusEmail(title, msgBody),
        });
      } catch (err) {
        console.error('[Admin Notification Email] Failed:', err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Notification sent to ${lab.user.name}.`,
    });
  })
);

/**
 * GET /api/labs/admin/stats/overview
 * Admin dashboard stats for labs.
 */
router.get(
  '/admin/stats/overview',
  protect,
  authorize('admin', 'superadmin'),
  cache(60),
  asyncHandler(async (req, res) => {
    const [statusCounts, typeCounts, totalLabs, activeLabs, featuredLabs] =
      await Promise.all([
        LabPartnerProfile.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        LabPartnerProfile.aggregate([
          { $group: { _id: '$labType', count: { $sum: 1 } } },
        ]),
        LabPartnerProfile.countDocuments(),
        LabPartnerProfile.countDocuments({ isActive: true, status: 'approved' }),
        LabPartnerProfile.countDocuments({ isFeatured: true, isActive: true }),
      ]);

    const byStatus = {};
    statusCounts.forEach((s) => { byStatus[s._id] = s.count; });

    const byType = {};
    typeCounts.forEach((t) => { byType[t._id] = t.count; });

    return res.status(200).json({
      success: true,
      data: {
        totalLabs,
        activeLabs,
        featuredLabs,
        byStatus,
        byType,
      },
    });
  })
);

export default router;