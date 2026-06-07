import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import ImageKit from 'imagekit';
import fs from 'fs';
import EPrescription from '../../models/EPrescription.js';
import User from '../../models/User.js';
import CustomerProfile from '../../models/CustomerProfile.js';
import Notification from '../../models/Notification.js';
import sendEmail from '../../utils/sendEmail.js';
import { transactionalTemplate } from '../../utils/emailTemplates.js';
import { protect, authorize } from '../../middleware/authMiddleware.js';

const router = express.Router();

// ─── ImageKit ─────────────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ─── Multer (memory storage — no disk writes) ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPEG, PNG, WEBP and PDF files are allowed'));
  },
});

// ─── Helper: Upload buffer to ImageKit ────────────────────────────────────────
const uploadToImageKit = (buffer, filename, folder = 'Likeson/customer-docs') =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      { file: buffer, fileName: filename, folder },
      (err, result) => (err ? reject(err) : resolve(result.url)),
    );
  });

// ─── All routes require authentication + customer role ────────────────────────
router.use(protect);
router.use(authorize('customer'));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GET /me  —  Full profile (User + CustomerProfile)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      '-password -otp -otpExpires -deviceTokens',
    );

    const profile = await CustomerProfile.findOne({ user: req.user._id });

    res.status(200).json({
      success: true,
      data: { user, profile: profile || {} },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PUT /me  —  Update User fields (name, phone, location, workStatus …)
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/me', async (req, res) => {
  try {
    const ALLOWED_USER_FIELDS = [
      'name', 'phone', 'workStatus', 'lastKnownAddress',
      'termsAcceptedAt', 'privacyPolicyAcceptedAt',
      'location',
    ];

    const updates = {};
    ALLOWED_USER_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Prevent role / security field tampering
    delete updates.role;
    delete updates.isBlocked;
    delete updates.password;

    updates.updatedBy = req.user._id;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true },
    ).select('-password -otp -otpExpires -deviceTokens');

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PUT /me/profile  —  Upsert CustomerProfile (all schema fields)
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/me/profile', async (req, res) => {
  try {
    const ALLOWED = [
      'gender', 'dob', 'bloodGroup', 'emergencyContact', 'snapshot',
    ];

    const updates = {};
    ALLOWED.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true },
    );

    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. POST /me/kyc  —  Add / update a KYC document entry (with file upload)
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  '/me/kyc',
  upload.fields([{ name: 'documentFile', maxCount: 1 }, { name: 'backSideFile', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { type, documentNumber, holderName } = req.body;
      if (!type) return res.status(400).json({ success: false, message: 'Document type is required' });

      let documentUrl, backSideUrl;

      if (req.files?.documentFile?.[0]) {
        const file = req.files.documentFile[0];
        documentUrl = await uploadToImageKit(
          file.buffer,
          `kyc-${req.user._id}-${Date.now()}-front`,
        );
      }

      if (req.files?.backSideFile?.[0]) {
        const file = req.files.backSideFile[0];
        backSideUrl = await uploadToImageKit(
          file.buffer,
          `kyc-${req.user._id}-${Date.now()}-back`,
        );
      }

      const kycEntry = {
        type,
        documentNumber,
        holderName,
        verificationStatus: 'Pending',
        ...(documentUrl && { documentUrl }),
        ...(backSideUrl && { backSideUrl }),
      };

      // Replace existing entry of same type, or push new
      const profile = await CustomerProfile.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { kyc: { type } } },
        { new: true },
      );

      const updated = await CustomerProfile.findOneAndUpdate(
        { user: req.user._id },
        { $push: { kyc: kycEntry } },
        { new: true, upsert: true },
      );

      res.status(200).json({ success: true, data: updated.kyc });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// 5. POST /me/government-schemes  —  Add a government scheme entry
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  '/me/government-schemes',
  upload.single('documentFile'),
  async (req, res) => {
    try {
      const { schemeName, beneficiaryId, holderName } = req.body;
      if (!schemeName) return res.status(400).json({ success: false, message: 'schemeName is required' });

      let documentUrl;
      if (req.file) {
        documentUrl = await uploadToImageKit(
          req.file.buffer,
          `scheme-${req.user._id}-${Date.now()}`,
        );
      }

      const schemeEntry = {
        schemeName,
        beneficiaryId,
        holderName,
        isVerified: false,
        ...(documentUrl && { documentUrl }),
      };

      const profile = await CustomerProfile.findOneAndUpdate(
        { user: req.user._id },
        { $push: { governmentSchemes: schemeEntry } },
        { new: true, upsert: true },
      );

      res.status(201).json({ success: true, data: profile.governmentSchemes });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// DELETE /me/government-schemes/:schemeId
router.delete('/me/government-schemes/:schemeId', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { governmentSchemes: { _id: req.params.schemeId } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.governmentSchemes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Medical Timeline CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// POST /me/medical-timeline  — Add event (with optional report file uploads)
router.post(
  '/me/medical-timeline',
  upload.array('reportFiles', 5),
  async (req, res) => {
    try {
      const { eventTitle, hospitalName, description, doctorName, date } = req.body;
      if (!eventTitle) return res.status(400).json({ success: false, message: 'eventTitle is required' });

      let reportUrls = [];
      if (req.files?.length) {
        reportUrls = await Promise.all(
          req.files.map((f, i) =>
            uploadToImageKit(f.buffer, `report-${req.user._id}-${Date.now()}-${i}`, 'Likeson/reports'),
          ),
        );
      }

      const event = { eventTitle, hospitalName, description, doctorName, reportUrls, date: date || Date.now() };

      const profile = await CustomerProfile.findOneAndUpdate(
        { user: req.user._id },
        { $push: { medicalTimeline: { $each: [event], $sort: { date: -1 } } } },
        { new: true, upsert: true },
      );

      res.status(201).json({ success: true, data: profile.medicalTimeline });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PUT /me/medical-timeline/:eventId  — Edit event
router.put('/me/medical-timeline/:eventId', async (req, res) => {
  try {
    const { eventTitle, hospitalName, description, doctorName, date } = req.body;
    const setObj = {};
    if (eventTitle)   setObj['medicalTimeline.$.eventTitle']   = eventTitle;
    if (hospitalName) setObj['medicalTimeline.$.hospitalName'] = hospitalName;
    if (description)  setObj['medicalTimeline.$.description']  = description;
    if (doctorName)   setObj['medicalTimeline.$.doctorName']   = doctorName;
    if (date)         setObj['medicalTimeline.$.date']         = date;

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id, 'medicalTimeline._id': req.params.eventId },
      { $set: setObj },
      { new: true },
    );

    if (!profile) return res.status(404).json({ success: false, message: 'Event not found' });
    res.status(200).json({ success: true, data: profile.medicalTimeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /me/medical-timeline/:eventId
router.delete('/me/medical-timeline/:eventId', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { medicalTimeline: { _id: req.params.eventId } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.medicalTimeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Medicine History CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// POST /me/medicine-history
router.post('/me/medicine-history', async (req, res) => {
  try {
    const { medicineName, dosage, frequency, startDate, endDate, isOngoing, prescribingDoctor, instructions } = req.body;
    if (!medicineName) return res.status(400).json({ success: false, message: 'medicineName is required' });

    const entry = { medicineName, dosage, frequency, startDate, endDate, isOngoing, prescribingDoctor, instructions };

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $push: { medicineHistory: entry } },
      { new: true, upsert: true },
    );

    res.status(201).json({ success: true, data: profile.medicineHistory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /me/medicine-history/:medId
router.put('/me/medicine-history/:medId', async (req, res) => {
  try {
    const fields = ['medicineName', 'dosage', 'frequency', 'startDate', 'endDate', 'isOngoing', 'prescribingDoctor', 'instructions'];
    const setObj = {};
    fields.forEach((f) => {
      if (req.body[f] !== undefined) setObj[`medicineHistory.$.${f}`] = req.body[f];
    });

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id, 'medicineHistory._id': req.params.medId },
      { $set: setObj },
      { new: true },
    );

    if (!profile) return res.status(404).json({ success: false, message: 'Medicine record not found' });
    res.status(200).json({ success: true, data: profile.medicineHistory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /me/medicine-history/:medId
router.delete('/me/medicine-history/:medId', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { medicineHistory: { _id: req.params.medId } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.medicineHistory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. GET /me/audit-sessions  —  All active login sessions
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/audit-sessions', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('auditSessions');
    res.status(200).json({
      success: true,
      count: user.auditSessions.length,
      data:  user.auditSessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. DELETE /me/audit-sessions/:sessionId  —  Remote-logout a specific session
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/me/audit-sessions/:sessionId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { auditSessions: { _id: req.params.sessionId } } },
      { new: true },
    ).select('auditSessions');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Notify via push / in-app
    await Notification.create({
      recipient: req.user._id,
      title:     'Session Terminated',
      body:      'A login session was remotely signed out from your account.',
      type:      'Account_Security',
      priority:  'High',
      channels:  [{ channel: 'InApp', status: 'Sent' }],
    });

    res.status(200).json({
      success: true,
      message: 'Session removed. That device has been logged out.',
      data:    user.auditSessions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /me/audit-sessions  —  Remove ALL sessions (logout everywhere)
router.delete('/me/audit-sessions', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { auditSessions: [] } },
      { new: true },
    ).select('auditSessions');

    await Notification.create({
      recipient: req.user._id,
      title:     'All Sessions Terminated',
      body:      'You have been signed out of all devices.',
      type:      'Account_Security',
      priority:  'High',
      channels:  [{ channel: 'InApp', status: 'Sent' }],
    });

    res.status(200).json({ success: true, message: 'All sessions cleared. Logged out from every device.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. DELETE /me/device-tokens/:tokenId  —  Remove a push notification token
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/me/device-tokens/:tokenId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { deviceTokens: { _id: req.params.tokenId } } },
      { new: true },
    ).select('deviceTokens');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'Device token removed.',
      data:    user.deviceTokens,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. POST /me/request-unblock  —  Request account unblock (sends email to admin)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/me/request-unblock', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // The user might still be making this request even if their block just expired
    // (isCurrentlyBlocked is a virtual that respects expiry). Allow only truly blocked users.
    if (!user.isCurrentlyBlocked) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not currently blocked.',
      });
    }

    const { reason } = req.body; // Reason provided by the customer

    // 1. Notify the customer via in-app
    await Notification.create({
      recipient: req.user._id,
      title:     'Unblock Request Received',
      body:      'Your unblock request has been submitted. Our team will review it shortly.',
      type:      'Account_Status',
      priority:  'Medium',
      channels:  [{ channel: 'InApp', status: 'Sent' }],
    });

    // 2. Send email to support/admin team
    await sendEmail({
      email:   process.env.SUPPORT_EMAIL || process.env.SMTP_EMAIL,
      subject: `Account Unblock Request — ${user.name} (${user.email})`,
      html:    transactionalTemplate({
        header:     'Account Unblock Request',
        title:      `User ${user.name} has requested to be unblocked`,
        body:       `
          <p><strong>User ID:</strong> ${user._id}</p>
          <p><strong>Name:</strong> ${user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
          <p><strong>Block Reason:</strong> ${user.blockReason || 'Not specified'}</p>
          <p><strong>Auto-Unblock At:</strong> ${user.unblockAt ? new Date(user.unblockAt).toLocaleString('en-IN') : 'Manual block (no expiry)'}</p>
          <p><strong>Customer's Statement:</strong> ${reason || 'No statement provided'}</p>
        `,
        buttonText: 'Go to Admin Panel',
        buttonLink: process.env.ADMIN_PANEL_URL || '#',
      }),
    });

    res.status(200).json({
      success: true,
      message: 'Your unblock request has been submitted. Our team will get back to you soon.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. GET /me/notifications  —  Paginated in-app notifications
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/notifications', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = { recipient: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      data: notifications,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /me/notifications/:id/read  —  Mark single notification as read
router.patch('/me/notifications/:id/read', async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.status(200).json({ success: true, data: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /me/notifications/read-all  —  Mark all as read
router.patch('/me/notifications/read-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    res.status(200).json({ success: true, message: `${result.modifiedCount} notifications marked as read.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. GET /me/snapshot  —  Quick emergency snapshot (vitals + chronic + allergies)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/snapshot', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({ user: req.user._id }).select(
      'snapshot emergencyContact bloodGroup',
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /me/snapshot  —  Update snapshot vitals
router.put('/me/snapshot', async (req, res) => {
  try {
    const { chronicConditions, allergies, vitals, primaryLanguage } = req.body;
    const setObj = {};
    if (chronicConditions !== undefined) setObj['snapshot.chronicConditions'] = chronicConditions;
    if (allergies          !== undefined) setObj['snapshot.allergies']          = allergies;
    if (primaryLanguage    !== undefined) setObj['snapshot.primaryLanguage']    = primaryLanguage;
    if (vitals) {
      const allowedVitals = ['bloodPressure', 'sugarLevel', 'heightCm', 'weightKg'];
      allowedVitals.forEach((v) => {
        if (vitals[v] !== undefined) setObj[`snapshot.vitals.${v}`] = vitals[v];
      });
      setObj['snapshot.vitals.lastUpdated'] = new Date();
    }

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: setObj },
      { new: true, upsert: true },
    ).select('snapshot');

    res.status(200).json({ success: true, data: profile.snapshot });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// ═══════════════════════════════════════════════════════════════════════════════
// 14. GET /me/prescriptions  —  All prescriptions for logged-in customer
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/prescriptions', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = {
      'patient.userId': req.user._id,
      ...(req.query.status && { status: req.query.status }),
    };

    const [prescriptions, total] = await Promise.all([
      EPrescription.find(filter)
        .sort({ issuedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-medicines.instructions -doctor.signatureUrl'), // trim sensitive
      EPrescription.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      data: prescriptions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. GET /me/prescriptions/:rxNumber  —  Single prescription by RX number
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/prescriptions/:rxNumber', async (req, res) => {
  try {
    const rx = await EPrescription.findOne({
      rxNumber:          req.params.rxNumber,
      'patient.userId':  req.user._id,
    });

    if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found' });

    res.status(200).json({ success: true, data: rx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. GET /me/reports  —  All uploaded report files (across medicalTimeline)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/reports', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({ user: req.user._id })
      .select('medicalTimeline');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    // Flatten all events that have reportUrls
    const reports = profile.medicalTimeline
      .filter(e => e.reportUrls?.length)
      .map(e => ({
        eventId:      e._id,
        eventTitle:   e.eventTitle,
        hospitalName: e.hospitalName,
        doctorName:   e.doctorName,
        date:         e.date,
        reportUrls:   e.reportUrls,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      total:   reports.length,
      data:    reports,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. POST /me/reports/:eventId/upload  —  Add more report files to existing event
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  '/me/reports/:eventId/upload',
  upload.array('reportFiles', 5),
  async (req, res) => {
    try {
      if (!req.files?.length)
        return res.status(400).json({ success: false, message: 'No files uploaded' });

      const newUrls = await Promise.all(
        req.files.map((f, i) =>
          uploadToImageKit(
            f.buffer,
            `report-${req.user._id}-${Date.now()}-${i}`,
            'Likeson/reports',
          ),
        ),
      );

      const profile = await CustomerProfile.findOneAndUpdate(
        { user: req.user._id, 'medicalTimeline._id': req.params.eventId },
        { $push: { 'medicalTimeline.$.reportUrls': { $each: newUrls } } },
        { new: true },
      );

      if (!profile) return res.status(404).json({ success: false, message: 'Event not found' });

      const event = profile.medicalTimeline.id(req.params.eventId);
      res.status(200).json({ success: true, data: event });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// 18. DELETE /me/reports/:eventId/file  —  Remove one report URL from event
//     Body: { url: "https://ik.imagekit.io/..." }
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/me/reports/:eventId/file', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'url required in body' });

    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id, 'medicalTimeline._id': req.params.eventId },
      { $pull: { 'medicalTimeline.$.reportUrls': url } },
      { new: true },
    );

    if (!profile) return res.status(404).json({ success: false, message: 'Event not found' });

    const event = profile.medicalTimeline.id(req.params.eventId);
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. GET /me/kyc  —  All KYC docs
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/me/kyc', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({ user: req.user._id }).select('kyc');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. DELETE /me/kyc/:type  —  Remove KYC entry by type (e.g. "Aadhaar")
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/me/kyc/:type', async (req, res) => {
  try {
    const profile = await CustomerProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { kyc: { type: req.params.type } } },
      { new: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.status(200).json({ success: true, data: profile.kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;