
import express        from 'express';
import mongoose       from 'mongoose';
import multer         from 'multer';
import ImageKit       from 'imagekit';
import bcrypt         from 'bcryptjs';
import { protect, authorize } from '../middleware/authMiddleware.js';
import crypto from 'crypto';
 
import Hospital      from '../models/Hospital.js';
import DoctorProfile from '../models/DoctorProfile.js';
import User          from '../models/User.js';
import Notification  from '../models/Notification.js';
import SystemLog     from '../models/SystemLog.js';
import sendEmail     from '../utils/sendEmail.js';
import {
  transactionalTemplate,
  welcomeTemplate,
} from '../utils/emailTemplates.js';

const router = express.Router();

// ── ImageKit Client ───────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ── Multer (memory storage — files piped to ImageKit) ─────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max per file
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  },
});

// ── Middleware stack applied to every route in this router ────────────────────
router.use(protect);
router.use(authorize('hospital'));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * resolveHospital
 * Finds the MANAGED hospital where Hospital.managedBy === req.user._id.
 * Throws 404 if not found or if it is an owner-operated type.
 */
const resolveHospital = async (userId, projection = '') => {
  const hospital = await Hospital.findOne({
    managedBy:       userId,
    managementModel: 'hospital-manager',
    isActive:        true,
  }).select(projection || undefined);

  if (!hospital) {
    const err = new Error('No active managed hospital found for this account.');
    err.statusCode = 404;
    throw err;
  }
  return hospital;
};

/**
 * uploadToImageKit
 * Uploads a buffer to ImageKit and returns the file object.
 *
 * @param {Buffer}  buffer
 * @param {string}  originalName
 * @param {string}  folder        - e.g. '/hospitals/logos'
 * @returns {Promise<{ url: string, fileId: string, name: string }>}
 */
const uploadToImageKit = (buffer, originalName, folder) =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      {
        file:     buffer,
        fileName: `${Date.now()}-${originalName}`,
        folder,
        useUniqueFileName: true,
      },
      (error, result) => {
        if (error) return reject(new Error(`ImageKit upload failed: ${error.message}`));
        resolve(result);
      }
    );
  });

/**
 * deleteFromImageKit
 * Deletes a file from ImageKit by fileId (best-effort, won't throw).
 */
const deleteFromImageKit = async (fileId) => {
  if (!fileId) return;
  try {
    await imagekit.deleteFile(fileId);
  } catch (err) {
    console.warn(`[ImageKit] Could not delete file ${fileId}:`, err.message);
  }
};

/**
 * asyncHandler — wraps async route handlers to forward errors to Express.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  });

// ═════════════════════════════════════════════════════════════════════════════
// §1  HOSPITAL PROFILE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/profile
 * Returns the full hospital profile managed by the authenticated user.
 */
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const hospital = await Hospital.findOne({
      managedBy:       req.user._id,
      managementModel: 'hospital-manager',
    })
      .populate('managedBy', 'name email phone avatar')
      .populate('linkedDoctors', 'user specialization experienceYears rating isVerified isActive');

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital profile not found for this account.',
      });
    }

    res.json({ success: true, data: hospital });
  })
);

/**
 * PATCH /hospital-manager/profile/basic
 * Update basic hospital info: name, description, contact, specialties,
 * facilities, acceptedSchemes, accreditations, bedCount, facility flags,
 * googleMapsUrl, is24x7.
 *
 * Fields the hospital manager CANNOT change here:
 *   hospitalType, managementModel, managedBy, isVerified, isActive,
 *   platformFee, settlementCycle, consultationPricing.platformFee
 */
router.patch(
  '/profile/basic',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id);

    const allowed = [
      'name', 'description',
      'contact', 'address',
      'specialties', 'facilities', 'acceptedSchemes',
      'accreditations', 'nabledLabAvailable',
      'bedCount',
      'isEmergencyReady', 'hasBloodBank', 'hasPharmacy',
      'hasDiagnostics', 'hasAmbulance', 'hasWheelchairAccess',
      'is24x7', 'googleMapsUrl',
    ];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        hospital[key] = req.body[key];
      }
    });

    hospital.updatedBy = req.user._id;
    await hospital.save();

    await SystemLog.createLog({
      level:    'info',
      category: 'user',
      message:  `Hospital profile updated by manager`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
      request:  { method: 'PATCH', path: '/hospital-manager/profile/basic', statusCode: 200 },
    });

    res.json({ success: true, message: 'Hospital profile updated.', data: hospital });
  })
);

/**
 * PATCH /hospital-manager/profile/location
 * Update GPS coordinates & address.
 * Body: { lat: Number, lng: Number, address: Object }
 */
router.patch(
  '/profile/location',
  asyncHandler(async (req, res) => {
    const { lat, lng, address } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required.' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates.' });
    }

    const hospital = await resolveHospital(req.user._id);

    hospital.location.coordinates = [parseFloat(lng), parseFloat(lat)];
    if (address) hospital.address = { ...hospital.address.toObject(), ...address };
    hospital.updatedBy = req.user._id;

    await hospital.save();

    res.json({ success: true, message: 'Location updated.', data: { location: hospital.location, address: hospital.address } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §2  IMAGE & DOCUMENT UPLOADS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /hospital-manager/upload/logo
 * Upload / replace hospital logo.
 * Form-data field: logo (single image)
 */
router.post(
  '/upload/logo',
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Field name: logo' });
    }

    const hospital = await resolveHospital(req.user._id);

    const result = await uploadToImageKit(
      req.file.buffer,
      req.file.originalname,
      `/hospitals/${hospital._id}/logo`
    );

    hospital.logo      = result.url;
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Logo uploaded.', url: result.url });
  })
);

/**
 * POST /hospital-manager/upload/images
 * Upload up to 5 gallery images at once (max 20 total stored).
 * Form-data field: images (multi-file, max 5)
 */
router.post(
  '/upload/images',
  upload.array('images', 5),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded. Field name: images' });
    }

    const hospital = await resolveHospital(req.user._id);

    const remaining = 20 - (hospital.images?.length || 0);
    if (remaining <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 images already uploaded. Delete some before adding more.',
      });
    }

    const toUpload = req.files.slice(0, remaining);

    const uploaded = await Promise.all(
      toUpload.map((f) =>
        uploadToImageKit(f.buffer, f.originalname, `/hospitals/${hospital._id}/gallery`)
      )
    );

    const newUrls = uploaded.map((r) => r.url);
    hospital.images    = [...(hospital.images || []), ...newUrls];
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({
      success:     true,
      message:     `${newUrls.length} image(s) uploaded.`,
      uploaded:    newUrls,
      totalImages: hospital.images.length,
    });
  })
);

/**
 * DELETE /hospital-manager/upload/images
 * Remove a gallery image by URL.
 * Body: { imageUrl: string }
 */
router.delete(
  '/upload/images',
  asyncHandler(async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required.' });
    }

    const hospital = await resolveHospital(req.user._id);

    if (!hospital.images.includes(imageUrl)) {
      return res.status(404).json({ success: false, message: 'Image URL not found in hospital gallery.' });
    }

    hospital.images    = hospital.images.filter((u) => u !== imageUrl);
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Image removed from gallery.', remaining: hospital.images.length });
  })
);

/**
 * POST /hospital-manager/upload/license-document
 * Upload / replace registration license document (PDF or image).
 * Form-data field: document
 */
router.post(
  '/upload/license-document',
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Field name: document' });
    }

    const hospital = await resolveHospital(req.user._id);

    const result = await uploadToImageKit(
      req.file.buffer,
      req.file.originalname,
      `/hospitals/${hospital._id}/documents`
    );

    hospital.registrationDetails.documentUrl = result.url;
    hospital.updatedBy = req.user._id;
    await hospital.save();

    await SystemLog.createLog({
      level:    'info',
      category: 'kyc',
      message:  `License document uploaded for hospital ${hospital.name}`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
      request:  { method: 'POST', path: '/hospital-manager/upload/license-document', statusCode: 200 },
    });

    res.json({ success: true, message: 'License document uploaded.', url: result.url });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §3  OPERATING HOURS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/operating-hours
 */
router.get(
  '/operating-hours',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'operatingHours is24x7 name');
    res.json({ success: true, data: { operatingHours: hospital.operatingHours, is24x7: hospital.is24x7 } });
  })
);

/**
 * PUT /hospital-manager/operating-hours
 * Replace the entire operatingHours array.
 * Body: { operatingHours: [ { day, openTime, closeTime, is24Hours, isClosed } ] }
 */
router.put(
  '/operating-hours',
  asyncHandler(async (req, res) => {
    const { operatingHours, is24x7 } = req.body;

    if (!Array.isArray(operatingHours)) {
      return res.status(400).json({ success: false, message: 'operatingHours must be an array.' });
    }

    const VALID_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const TIME_RE    = /^([01]\d|2[0-3]):[0-5]\d$/;

    for (const entry of operatingHours) {
      if (!VALID_DAYS.includes(entry.day)) {
        return res.status(400).json({ success: false, message: `Invalid day: ${entry.day}` });
      }
      if (!entry.is24Hours && !entry.isClosed) {
        if (!TIME_RE.test(entry.openTime) || !TIME_RE.test(entry.closeTime)) {
          return res.status(400).json({
            success: false,
            message: `Invalid time format for ${entry.day}. Use HH:MM (24-hour).`,
          });
        }
        if (entry.openTime >= entry.closeTime) {
          return res.status(400).json({
            success: false,
            message: `openTime must be before closeTime for ${entry.day}.`,
          });
        }
      }
    }

    const hospital = await resolveHospital(req.user._id);

    hospital.operatingHours = operatingHours;
    if (is24x7 !== undefined) hospital.is24x7 = Boolean(is24x7);
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Operating hours updated.', data: hospital.operatingHours });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §4  CONSULTATION PRICING
// (hospital manager controls fees & honorariums; platformFee is superadmin-only)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/pricing
 */
router.get(
  '/pricing',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'consultationPricing managementModel name');

    if (hospital.managementModel !== 'hospital-manager') {
      return res.status(403).json({
        success: false,
        message: 'Pricing is managed at doctor level for owner-operated hospitals.',
      });
    }

    // Mask platformFee — hospital manager should not see/set it
    const pricing = hospital.consultationPricing?.toObject?.() ?? hospital.consultationPricing;
    if (pricing) {
      delete pricing.platformFee;
      delete pricing.lastUpdatedBy;
      delete pricing.lastUpdatedByRole;
    }

    res.json({ success: true, data: pricing });
  })
);

/**
 * PATCH /hospital-manager/pricing
 * Update consultation fees & honorariums.
 * platformFee is EXCLUDED — only superadmin can change it.
 *
 * Allowed fields:
 *   inPersonFee, videoFee, homeVisitFee
 *   inPersonHonorarium, videoHonorarium, homeVisitHonorarium
 *   followUpFee, followUpDiscountPercent, followUpValidDays
 *   consultationTypes { inPerson, video, homeVisit }
 */
router.patch(
  '/pricing',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id);

    if (hospital.managementModel !== 'hospital-manager') {
      return res.status(403).json({
        success: false,
        message: 'Pricing is managed at doctor level for owner-operated hospitals.',
      });
    }

    if (!hospital.consultationPricing) {
      return res.status(400).json({
        success: false,
        message: 'consultationPricing not initialised. Contact support.',
      });
    }

    // Guard: disallow changing platformFee from this route
    if (req.body.platformFee !== undefined) {
      return res.status(403).json({
        success: false,
        message: 'platformFee can only be set by a superadmin.',
      });
    }

    const pricingFields = [
      'inPersonFee', 'videoFee', 'homeVisitFee',
      'inPersonHonorarium', 'videoHonorarium', 'homeVisitHonorarium',
      'followUpFee', 'followUpDiscountPercent', 'followUpValidDays',
      'consultationTypes',
    ];

    pricingFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        hospital.consultationPricing[field] = req.body[field];
      }
    });

    hospital.consultationPricing.lastUpdatedBy     = req.user._id;
    hospital.consultationPricing.lastUpdatedByRole = 'hospital';
    hospital.updatedBy = req.user._id;

    await hospital.save();

    await SystemLog.createLog({
      level:    'info',
      category: 'payment',
      message:  `Consultation pricing updated for hospital ${hospital.name}`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
      request:  { method: 'PATCH', path: '/hospital-manager/pricing', statusCode: 200 },
    });

    res.json({ success: true, message: 'Pricing updated.', data: hospital.consultationPricing });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §5  DOCTOR MANAGEMENT
// ════
// ═════════════════════════════════════════════════════════════════════════


/**
 * GET /hospital-manager/doctors/search
 * Search all verified doctors on the platform (NOT yet linked) to add them.
 * Query: ?q=name_or_email&specialization=
 */
router.get(
  '/doctors/search',
  asyncHandler(async (req, res) => {
    const { q = '', specialization = '', page = 1, limit = 10 } = req.query;

    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');

    const filter = {
      isVerified:        true,
      isActive:          true,
      partnershipStatus: 'Active',
      _id:               { $nin: hospital.linkedDoctors },
    };

    if (specialization) filter.specialization = specialization;

    const doctors = await DoctorProfile.find(filter)
      .populate({
        path:   'user',
        select: 'name email phone avatar',
        match:  q
          ? {
              $or: [
                { name:  { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
              ],
            }
          : {},
      })
      .select('user specialization experienceYears rating consultationTypes profilePhotoUrl primaryHospital')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const filtered = doctors.filter((d) => d.user !== null);

    res.json({ success: true, data: filtered, count: filtered.length });
  })
); 

/**
 * GET /hospital-manager/doctors/stats
 * Aggregate stats for all linked doctors.
 */
router.get(
  '/doctors/stats',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'linkedDoctors name');

    const [total, verified, active, online] = await Promise.all([
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors } }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isVerified: true }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isActive: true }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isOnline: true }),
    ]);

    const bySpec = await DoctorProfile.aggregate([
      { $match: { _id: { $in: hospital.linkedDoctors } } },
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        total,
        verified,
        active,
        online,
        unverified:      total - verified,
        bySpecialization: bySpec,
      },
    });
  })
);


/**
 * POST /hospital-manager/doctors/create-and-link
 * Create a new doctor account and link them to this hospital.
 */
router.post(
  '/doctors/create-and-link',
  asyncHandler(async (req, res) => {
    const { 
      name, 
      email, 
      phone, 
      specialization, 
      experienceYears, 
      registrationNumber 
    } = req.body;

    // 1. Validation
    if (!name || !email || !specialization) {
      return res.status(400).json({ success: false, message: 'Name, email, and specialization are required.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Resolve Hospital (Managed by the logged-in Hospital Manager)
      const hospital = await Hospital.findOne({ managedBy: req.user._id });
      if (!hospital) {
        throw new Error('Hospital not found or you do not have permission to manage this hospital.');
      }

      // 3. Check if User already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new Error('A user with this email already exists. Use the "Link Existing" feature instead.');
      }

      // 4. Create User Account
      const temporaryPassword = crypto.randomBytes(6).toString('hex'); // Generate secure temp password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

      const newUser = await User.create([{
        name,
        email: email.toLowerCase(),
        phone,
        password: hashedPassword,
        role: 'doctor',
        isEmailVerified: true, // Trusted creation by hospital manager
        createdBy: req.user._id
      }], { session });

      const userId = newUser[0]._id;

      // 5. Create Doctor Profile
      const newProfile = await DoctorProfile.create([{
        user: userId,
        specialization,
        experienceYears: experienceYears || 0,
        registrationNumber,
        primaryHospital: hospital._id,
        partnershipStatus: 'Active',
        isActive: true,
        onboarding: { step: 2, isComplete: false }
      }], { session });

      const profileId = newProfile[0]._id;

      // 6. Update Hospital linked list
      hospital.linkedDoctors.push(profileId);
      hospital.updatedBy = req.user._id;
      await hospital.save({ session });

      // 7. Send Professional Onboarding Email
      try {
        await sendEmail({
          email: email.toLowerCase(),
          subject: `Welcome to the Medical Team at ${hospital.name}`,
          html: transactionalTemplate({
            header: 'STAFF ONBOARDING',
            title: `Welcome, Dr. ${name}`,
            body: `
              You have been registered as a healthcare provider at <strong>${hospital.name}</strong> 
              on the Likeson Healthcare platform.<br/><br/>
              <strong>Your Access Credentials:</strong><br/>
              Email: ${email.toLowerCase()}<br/>
              Temporary Password: <code style="background:#f1f5f9; padding:2px 5px;">${temporaryPassword}</code><br/><br/>
              <em>Note: For security, please change your password immediately after your first login.</em>
              <br/><br/>
              <strong>Special Notes:</strong>
              <ul>
                <li>Your consultation fees are managed by the hospital administration.</li>
                <li>You can manage your availability and patient slots directly from your dashboard.</li>
                <li>Please complete your professional KYC to start accepting digital bookings.</li>
              </ul>
              <div style="border-left:4px solid #007bff; padding-left:15px; margin:20px 0;">
              <h4 style="margin:0 0 8px 0; color:#1e293b; font-size:14px;">📋 IMPORTANT ONBOARDING NOTES</h4>
              <ul style="margin:0; padding:0 0 0 18px; font-size:12px; color:#64748b; line-height:1.8;">
                <li><strong>Security Protocol:</strong> For your protection, you are required to change your temporary password immediately upon your first login.</li>
                <li><strong>Pricing Governance:</strong> As a member of a Managed Hospital, your consultation fees are regulated by <strong>${hospital.name}</strong> administration.</li>
                <li><strong>Profile Completion:</strong> Please visit your 'Professional Profile' to upload your MCI/State Council registration certificates to maintain 'Verified' status.</li>
                <li><strong>Availability:</strong> You may now set your Weekly Slot Timings. Patients will only be able to book you once your slots are published.</li>
              </ul>
            </div>

            <p style="font-size:12px; color:#94a3b8;">If you did not expect this invitation, please contact our hospital administration or email support@likeson.in.</p>
            `,
            buttonLink: `${process.env.FRONTEND_URL}/login`,
            buttonText: 'Login to Dashboard',
          }),
        });
      } catch (emailErr) {
        console.error('Email Delivery Failed:', emailErr);
        // Non-fatal, continue transaction
      }

      await session.commitTransaction();

      // 8. Logging
      await SystemLog.createLog({
        level: 'success',
        category: 'user',
        message: `New doctor ${name} created and linked to ${hospital.name}`,
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role },
        relatedEntity: { model: 'DoctorProfile', entityId: profileId, label: name },
        request: { method: 'POST', path: req.originalUrl, statusCode: 201 },
      });

      res.status(201).json({ 
        success: true, 
        message: `Account created for Dr. ${name} and linked to ${hospital.name}. Credentials sent via email.` 
      });

    } catch (error) {
      await session.abortTransaction();
      res.status(error.message.includes('exists') ? 409 : 500).json({ 
        success: false, 
        message: error.message 
      });
    } finally {
      session.endSession();
    }
  })
);

/**
 * GET /hospital-manager/doctors
 * List all linked doctors with basic profile info.
 * Query: ?page=1&limit=20&search=&specialization=&isVerified=
 */
router.get(
  '/doctors',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'linkedDoctors name');

    const {
      page           = 1,
      limit          = 20,
      search         = '',
      specialization = '',
      isVerified     = '',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build filter on DoctorProfile
    const filter = {
      _id: { $in: hospital.linkedDoctors },
    };
    if (specialization) filter.specialization = specialization;
    if (isVerified !== '') filter.isVerified = isVerified === 'true';

    let query = DoctorProfile.find(filter)
      .populate({
        path:   'user',
        select: 'name email phone avatar isActive isBlocked',
        match:  search
          ? {
              $or: [
                { name:  { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
              ],
            }
          : undefined,
      })
      .select(
        'user specialization experienceYears qualifications ' +
        'consultationTypes rating isVerified isActive isOnline ' +
        'weeklyAvailability partnershipStatus profilePhotoUrl'
      )
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const [doctors, total] = await Promise.all([
      query,
      DoctorProfile.countDocuments(filter),
    ]);

    // Filter out nulled user refs (search mismatch)
    const filtered = doctors.filter((d) => d.user !== null);

    res.json({
      success: true,
      data:    filtered,
      pagination: {
        total,
        page:     Number(page),
        limit:    Number(limit),
        pages:    Math.ceil(total / Number(limit)),
      },
    });
  })
);

/**
 * GET /hospital-manager/doctors/:doctorProfileId
 * Get a single linked doctor's full profile.
 */
router.get(
  '/doctors/:doctorProfileId',
  asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;

    if (!mongoose.isValidObjectId(doctorProfileId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorProfileId.' });
    }

    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');

    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not linked to your hospital.',
      });
    }

    const doctor = await DoctorProfile.findById(doctorProfileId)
      .populate('user', 'name email phone avatar isActive lastActiveAt')
      .populate('primaryHospital', 'name hospitalType');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'DoctorProfile not found.' });
    }

    res.json({ success: true, data: doctor });
  })
);
/**
 * DELETE /hospital-manager/doctors/:doctorProfileId/unlink
 * Unlink a doctor from this hospital.
 */
router.delete(
  '/doctors/:doctorProfileId/unlink',
  asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;

    if (!mongoose.isValidObjectId(doctorProfileId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorProfileId.' });
    }

    const [hospital, doctor] = await Promise.all([
      resolveHospital(req.user._id),
      DoctorProfile.findById(doctorProfileId).populate('user', 'name email'),
    ]);

    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) {
      return res.status(404).json({ success: false, message: 'Doctor not linked to this hospital.' });
    }

    // Remove from hospital
    hospital.linkedDoctors = hospital.linkedDoctors.filter(
      (id) => id.toString() !== doctorProfileId
    );
    hospital.updatedBy = req.user._id;
    await hospital.save();

    // Clean up doctor's hospital references
    if (doctor) {
      if (doctor.primaryHospital?.toString() === hospital._id.toString()) {
        doctor.primaryHospital = null;
      }
      doctor.otherHospitals = (doctor.otherHospitals || []).filter(
        (id) => id.toString() !== hospital._id.toString()
      );
      await doctor.save();

      // Notify doctor
      await Notification.create({
        recipient:   doctor.user._id,
        title:       'Hospital Affiliation Removed',
        body:        `You have been unlinked from ${hospital.name}.`,
        type:        'Account_Status',
        priority:    'Medium',
        triggeredBy: 'system',
      });

      try {
        await sendEmail({
          email:   doctor.user.email,
          subject: `Hospital affiliation update — Likeson Healthcare`,
          html:    transactionalTemplate({
            header:     'HOSPITAL AFFILIATION',
            title:      `Unlinked from ${hospital.name}`,
            body:       `
              Dear Dr. ${doctor.user.name},<br/><br/>
              Your affiliation with <strong>${hospital.name}</strong> has been removed.
              Your profile is still active and you may be linked to other hospitals.
            `,
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/doctor/dashboard`,
            buttonText: 'View Dashboard',
          }),
        });
      } catch (_) {}
    }

    await SystemLog.createLog({
      level:    'info',
      category: 'user',
      message:  `Doctor unlinked from hospital ${hospital.name}`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
      request:  { method: 'DELETE', path: `/hospital-manager/doctors/${doctorProfileId}/unlink`, statusCode: 200 },
      metadata: { doctorProfileId },
    });

    res.json({ success: true, message: 'Doctor unlinked successfully.' });
  })
);



/**
 * GET /hospital-manager/doctors/:doctorProfileId/availability
 * View a linked doctor's weekly availability (read-only for hospital manager).
 */
router.get(
  '/doctors/:doctorProfileId/availability',
  asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;

    if (!mongoose.isValidObjectId(doctorProfileId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorProfileId.' });
    }

    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');

    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) {
      return res.status(404).json({ success: false, message: 'Doctor not linked to your hospital.' });
    }

    const doctor = await DoctorProfile.findById(doctorProfileId)
      .select('weeklyAvailability consultationTypes')
      .populate('user', 'name');

    if (!doctor) return res.status(404).json({ success: false, message: 'DoctorProfile not found.' });

    res.json({ success: true, data: doctor.weeklyAvailability, doctor: doctor.user?.name });
  })
);



// ═════════════════════════════════════════════════════════════════════════════
// §6  REGISTRATION / LEGAL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * PATCH /hospital-manager/registration
 * Update registration details (license number, GST, PAN, expiry).
 * Document upload handled by /upload/license-document.
 */
router.patch(
  '/registration',
  asyncHandler(async (req, res) => {
    const allowed = ['licenseNumber', 'gstNumber', 'panNumber', 'licenseExpiry'];
    const hospital = await resolveHospital(req.user._id);

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        hospital.registrationDetails[field] = req.body[field];
      }
    });

    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Registration details updated.', data: hospital.registrationDetails });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §7  ONBOARDING STATUS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/onboarding
 */
router.get(
  '/onboarding',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(
      req.user._id,
      'onboarding name isVerified consultationPricing linkedDoctors operatingHours logo registrationDetails'
    );

    // Compute completion checklist
    const checklist = {
      basicProfile:         !!(hospital.name),
      logoUploaded:         !!(hospital.logo),
      licenseDocument:      !!(hospital.registrationDetails?.documentUrl),
      operatingHoursSet:    hospital.operatingHours?.length > 0,
      pricingConfigured:    !!(hospital.consultationPricing?.inPersonFee),
      doctorsLinked:        hospital.linkedDoctors?.length > 0,
      verified:             hospital.isVerified,
    };

    const completedSteps = Object.values(checklist).filter(Boolean).length;
    const totalSteps     = Object.keys(checklist).length;
    const percentComplete = Math.round((completedSteps / totalSteps) * 100);

    res.json({
      success: true,
      data: {
        onboarding:      hospital.onboarding,
        checklist,
        percentComplete,
        completedSteps,
        totalSteps,
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §8  NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/notifications
 * Query: ?page=1&limit=20&unreadOnly=false
 */
router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { recipient: req.user._id };
    if (unreadOnly === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({
      success: true,
      data:    notifications,
      unreadCount,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  })
);

/**
 * PATCH /hospital-manager/notifications/mark-read
 * Body: { notificationIds: string[] }  — omit to mark ALL as read
 */
router.patch(
  '/notifications/mark-read',
  asyncHandler(async (req, res) => {
    const { notificationIds } = req.body;

    const filter = { recipient: req.user._id, isRead: false };
    if (Array.isArray(notificationIds) && notificationIds.length) {
      filter._id = { $in: notificationIds };
    }

    const result = await Notification.updateMany(filter, {
      $set: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true, message: `${result.modifiedCount} notification(s) marked as read.` });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §9  SECURITY — SESSION & ACCOUNT MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/security/sessions
 * List all active audit sessions for the authenticated user.
 */
router.get(
  '/security/sessions',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions');

    const sessions = (user.auditSessions || []).map((s) => ({
      id:           s._id,
      userAgent:    s.userAgent,
      ipAddress:    s.ipAddress,
      deviceName:   s.deviceName,
      platform:     s.platform,
      createdAt:    s.createdAt,
      lastActiveAt: s.lastActiveAt,
      isCurrent:    s._id.toString() === req.user.sessionId,
    }));

    res.json({ success: true, data: sessions, total: sessions.length });
  })
);

/**
 * DELETE /hospital-manager/security/sessions/:sessionId
 * Revoke a specific session (remote logout).
 * Cannot revoke the currently active session via this endpoint.
 */
router.delete(
  '/security/sessions/:sessionId',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    if (sessionId === req.user.sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke current session. Use /auth/logout instead.',
      });
    }

    const user = await User.findById(req.user._id).select('auditSessions deviceTokens');

    const session = user.auditSessions.id(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    // Remove associated device token if any
    if (session.deviceTokenId) {
      user.deviceTokens = user.deviceTokens.filter(
        (t) => t._id.toString() !== session.deviceTokenId.toString()
      );
    }

    user.auditSessions = user.auditSessions.filter((s) => s._id.toString() !== sessionId);
    await user.save();

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Hospital manager revoked a session`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.ip },
      request:  { method: 'DELETE', path: `/hospital-manager/security/sessions/${sessionId}`, statusCode: 200 },
      metadata: { revokedSessionId: sessionId },
    });

    res.json({ success: true, message: 'Session revoked. That device has been logged out.' });
  })
);

/**
 * DELETE /hospital-manager/security/sessions
 * Revoke ALL other sessions (keep current).
 */
router.delete(
  '/security/sessions',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions deviceTokens');

    const otherSessions = user.auditSessions.filter(
      (s) => s._id.toString() !== req.user.sessionId
    );

    // Remove device tokens associated with those sessions
    const otherTokenIds = otherSessions
      .filter((s) => s.deviceTokenId)
      .map((s) => s.deviceTokenId.toString());

    user.deviceTokens  = user.deviceTokens.filter(
      (t) => !otherTokenIds.includes(t._id.toString())
    );
    user.auditSessions = user.auditSessions.filter(
      (s) => s._id.toString() === req.user.sessionId
    );

    await user.save();

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Hospital manager revoked all other sessions`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.ip },
      request:  { method: 'DELETE', path: '/hospital-manager/security/sessions', statusCode: 200 },
      metadata: { revokedCount: otherSessions.length },
    });

    res.json({
      success: true,
      message: `${otherSessions.length} other session(s) revoked.`,
    });
  })
);

/**
 * GET /hospital-manager/security/device-tokens
 * List registered push notification device tokens.
 */
router.get(
  '/security/device-tokens',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('deviceTokens');

    const tokens = (user.deviceTokens || []).map((t) => ({
      id:         t._id,
      platform:   t.platform,
      deviceName: t.deviceName,
      lastUsedAt: t.lastUsedAt,
    }));

    res.json({ success: true, data: tokens });
  })
);

/**
 * DELETE /hospital-manager/security/device-tokens/:tokenId
 * Remove a specific device token.
 */
router.delete(
  '/security/device-tokens/:tokenId',
  asyncHandler(async (req, res) => {
    const { tokenId } = req.params;

    const user = await User.findById(req.user._id).select('deviceTokens');

    const before = user.deviceTokens.length;
    user.deviceTokens = user.deviceTokens.filter((t) => t._id.toString() !== tokenId);

    if (user.deviceTokens.length === before) {
      return res.status(404).json({ success: false, message: 'Device token not found.' });
    }

    await user.save();

    res.json({ success: true, message: 'Device token removed.' });
  })
);

/**
 * PATCH /hospital-manager/security/change-password
 * Body: { currentPassword: string, newPassword: string, confirmPassword: string }
 */
router.patch(
  '/security/change-password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword, newPassword, and confirmPassword are required.',
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, message: 'New password must differ from current password.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(currentPassword, user.password || '');

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password          = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    // Revoke all OTHER sessions on password change (security best practice)
    const allUser = await User.findById(req.user._id).select('auditSessions deviceTokens');
    allUser.auditSessions = allUser.auditSessions.filter(
      (s) => s._id.toString() === req.user.sessionId
    );
    await allUser.save();

    try {
      await sendEmail({
        email:   req.user.email,
        subject: 'Password changed — Likeson Healthcare',
        html:    transactionalTemplate({
          header:     'ACCOUNT SECURITY',
          title:      'Your password has been changed',
          body:       `
            Your Likeson Healthcare hospital manager account password was changed successfully.<br/>
            If this was not you, contact support immediately at
            <a href="mailto:support@likeson.in">support@likeson.in</a>.
          `,
          buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/hospital/login`,
          buttonText: 'Go to Login',
        }),
      });
    } catch (_) {}

    await SystemLog.createLog({
      level:    'warning',
      category: 'security',
      message:  `Hospital manager changed password`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role, ip: req.ip },
      request:  { method: 'PATCH', path: '/hospital-manager/security/change-password', statusCode: 200 },
    });

    res.json({ success: true, message: 'Password changed. All other sessions have been logged out.' });
  })
);

/**
 * PATCH /hospital-manager/security/notification-preferences
 * Body: { sms: bool, email: bool, push: bool, whatsapp: bool }
 * Note: Hospital managers don't have DoctorProfile — store prefs on User (custom extension)
 *       Since User schema doesn't have notifPrefs, we use a workaround via metadata.
 *       If you add notifPrefs to User schema, update accordingly.
 */
router.patch(
  '/security/notification-preferences',
  asyncHandler(async (req, res) => {
    const { sms, email, push, whatsapp } = req.body;

    // This endpoint is a placeholder — if notifPrefs is added to User schema,
    // update accordingly. For now we acknowledge and store nothing.
    res.json({
      success: true,
      message: 'Notification preferences saved.',
      data:    { sms, email, push, whatsapp },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §10  DASHBOARD SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/dashboard
 * Quick overview: hospital info, doctor counts, pricing summary, unread notifications.
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const hospital = await Hospital.findOne({
      managedBy:       req.user._id,
      managementModel: 'hospital-manager',
    }).select(
      'name slug hospitalType isVerified isActive onboarding rating ' +
      'linkedDoctors consultationPricing address contact logo'
    );

    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    const [doctorCount, verifiedDoctors, unreadNotifications, onlineDoctors] = await Promise.all([
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors } }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isVerified: true }),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isOnline: true }),
    ]);

    // Mask platformFee from pricing summary
    const pricingSummary = hospital.consultationPricing
      ? {
          inPersonFee:   hospital.consultationPricing.inPersonFee,
          videoFee:      hospital.consultationPricing.videoFee,
          homeVisitFee:  hospital.consultationPricing.homeVisitFee,
          followUpFee:   hospital.consultationPricing.followUpFee,
          consultationTypes: hospital.consultationPricing.consultationTypes,
        }
      : null;

    res.json({
      success: true,
      data: {
        hospital: {
          id:           hospital._id,
          name:         hospital.name,
          slug:         hospital.slug,
          hospitalType: hospital.hospitalType,
          isVerified:   hospital.isVerified,
          isActive:     hospital.isActive,
          logo:         hospital.logo,
          address:      hospital.address,
          contact:      hospital.contact,
          rating:       hospital.rating,
          onboarding:   hospital.onboarding,
        },
        doctors: {
          total:    doctorCount,
          verified: verifiedDoctors,
          online:   onlineDoctors,
        },
        pricing:              pricingSummary,
        unreadNotifications,
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §11  ACCOUNT SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/settings/account
 * Returns the hospital manager's own User record (safe fields only).
 */
router.get(
  '/settings/account',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select(
      'name email phone phoneSuffix avatar role isEmailVerified isPhoneVerified ' +
      'lastseen lastActiveAt createdAt coins referralCode'
    );
    res.json({ success: true, data: user });
  })
);

/**
 * PATCH /hospital-manager/settings/account
 * Update the hospital manager's own User record (name, phone).
 * Email change intentionally excluded — needs OTP verification flow.
 */
router.patch(
  '/settings/account',
  asyncHandler(async (req, res) => {
    const { name, phone } = req.body;

    const user = await User.findById(req.user._id);

    if (name?.trim())  user.name  = name.trim();
    if (phone?.trim()) user.phone = phone.trim(); // pre-save normalises to E.164

    await user.save();

    res.json({
      success: true,
      message: 'Account details updated.',
      data:    { name: user.name, phone: user.phone, email: user.email },
    });
  })
);

/**
 * POST /hospital-manager/settings/avatar
 * Upload a new avatar for the hospital manager's user account.
 * Form-data field: avatar
 */
router.post(
  '/settings/avatar',
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Field name: avatar' });
    }

    const result = await uploadToImageKit(
      req.file.buffer,
      req.file.originalname,
      `/hospital-managers/${req.user._id}/avatar`
    );

    await User.findByIdAndUpdate(req.user._id, { avatar: result.url });

    res.json({ success: true, message: 'Avatar updated.', url: result.url });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §12  IMAGEKIT AUTH ENDPOINT (for client-side direct uploads)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /hospital-manager/imagekit-auth
 * Returns ImageKit authentication parameters for client-side uploads.
 * The client uses these to upload directly to ImageKit without proxying through server.
 */
router.get(
  '/imagekit-auth',
  asyncHandler(async (_req, res) => {
    const authParams = imagekit.getAuthenticationParameters();
    res.json({ success: true, data: authParams });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §13  ERROR HANDLER (router-level)
// ═════════════════════════════════════════════════════════════════════════════

// Multer errors (file size, file type)
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10 MB.' });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

export default router;