import express from 'express';
import { TermsAndConditions, PrivacyPolicy, UserConsent } from '../models/Legaldocuments.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();


// ═══════════════════════════════════════════════════════════════
// TERMS & CONDITIONS ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/legal/terms
 * @desc    Get the currently active Terms & Conditions (public)
 * @access  Public
 */
router.get('/terms', async (req, res) => {
  try {
    const terms = await TermsAndConditions.findOne({ isActive: true })
      .select('-previousVersions -__v')
      .lean();

    if (!terms) {
      return res.status(404).json({ success: false, message: 'No active Terms & Conditions found.' });
    }

    res.status(200).json({ success: true, data: terms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/legal/terms/all
 * @desc    Get all versions of Terms & Conditions (admin only)
 * @access  Private [superadmin, admin]
 */
router.get('/terms/all', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      TermsAndConditions.find()
        .select('-previousVersions -content -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TermsAndConditions.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: docs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/legal/terms/:id
 * @desc    Get a specific Terms version by ID (admin only)
 * @access  Private [superadmin, admin]
 */
router.get('/terms/:id', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const terms = await TermsAndConditions.findById(req.params.id).lean();
    if (!terms) return res.status(404).json({ success: false, message: 'Terms version not found.' });
    res.status(200).json({ success: true, data: terms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/legal/terms
 * @desc    Create a new Terms & Conditions version (draft, not yet active)
 * @access  Private [superadmin, admin]
 * @body    { version, content, summary, effectiveDate, changeLog, requiresReAcceptance, applicableRoles, roleSpecificClauses }
 */
router.post('/terms', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const {
      version, title, slug, content, summary,
      effectiveDate, changeLog, requiresReAcceptance,
      applicableRoles, roleSpecificClauses,
    } = req.body;

    const existing = await TermsAndConditions.findOne({ version });
    if (existing) {
      return res.status(400).json({ success: false, message: `Version "${version}" already exists.` });
    }

    const terms = await TermsAndConditions.create({
      version, title, slug, content, summary,
      effectiveDate, changeLog, requiresReAcceptance,
      applicableRoles, roleSpecificClauses,
      isActive: false, // Must be explicitly published
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: terms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PATCH /api/legal/terms/:id
 * @desc    Update a draft Terms version (cannot update an active one)
 * @access  Private [superadmin, admin]
 */
router.patch('/terms/:id', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const terms = await TermsAndConditions.findById(req.params.id);
    if (!terms) return res.status(404).json({ success: false, message: 'Terms version not found.' });

    if (terms.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit an active Terms document. Create a new version instead.',
      });
    }

    const allowedFields = [
      'title', 'slug', 'content', 'summary', 'effectiveDate',
      'changeLog', 'requiresReAcceptance', 'applicableRoles', 'roleSpecificClauses',
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) terms[field] = req.body[field];
    });
    terms.updatedBy = req.user._id;

    await terms.save();
    res.status(200).json({ success: true, data: terms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PATCH /api/legal/terms/:id/publish
 * @desc    Publish (activate) a Terms version — auto-deactivates current active
 * @access  Private [superadmin]
 */
router.patch('/terms/:id/publish', protect, authorize('superadmin'), async (req, res) => {
  try {
    const terms = await TermsAndConditions.findById(req.params.id);
    if (!terms) return res.status(404).json({ success: false, message: 'Terms version not found.' });
    if (terms.isActive) return res.status(400).json({ success: false, message: 'Already active.' });

    // Archive current active version into history before switching
    const current = await TermsAndConditions.findOne({ isActive: true });
    if (current) {
      terms.previousVersions.push({
        version: current.version,
        content: current.content,
        publishedAt: current.publishedAt || current.createdAt,
        publishedBy: current.publishedBy,
        changeLog: current.changeLog,
      });
    }

    terms.isActive = true;
    terms.publishedBy = req.user._id;
    terms.updatedBy = req.user._id;
    await terms.save(); // Middleware auto-deactivates old doc

    res.status(200).json({ success: true, message: `Terms v${terms.version} is now active.`, data: terms });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/legal/terms/:id
 * @desc    Delete a DRAFT (non-active) Terms version
 * @access  Private [superadmin]
 */
router.delete('/terms/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    const terms = await TermsAndConditions.findById(req.params.id);
    if (!terms) return res.status(404).json({ success: false, message: 'Terms version not found.' });
    if (terms.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot delete an active Terms document.' });
    }
    await terms.deleteOne();
    res.status(200).json({ success: true, message: 'Draft Terms version deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// PRIVACY POLICY ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/legal/privacy
 * @desc    Get the currently active Privacy Policy (public)
 * @access  Public
 */
router.get('/privacy', async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findOne({ isActive: true })
      .select('-previousVersions -__v')
      .lean();

    if (!policy) {
      return res.status(404).json({ success: false, message: 'No active Privacy Policy found.' });
    }

    res.status(200).json({ success: true, data: policy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/legal/privacy/all
 * @desc    Get all versions of Privacy Policy (admin only)
 * @access  Private [superadmin, admin]
 */
router.get('/privacy/all', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      PrivacyPolicy.find()
        .select('-previousVersions -content -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PrivacyPolicy.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: docs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/legal/privacy/:id
 * @desc    Get a specific Privacy Policy version by ID (admin only)
 * @access  Private [superadmin, admin]
 */
router.get('/privacy/:id', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findById(req.params.id).lean();
    if (!policy) return res.status(404).json({ success: false, message: 'Privacy Policy version not found.' });
    res.status(200).json({ success: true, data: policy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/legal/privacy
 * @desc    Create a new Privacy Policy version (draft)
 * @access  Private [superadmin, admin]
 * @body    { version, content, summary, effectiveDate, changeLog, complianceFrameworks, ... }
 */
router.post('/privacy', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const {
      version, title, slug, content, summary, effectiveDate, changeLog,
      requiresReAcceptance, applicableRoles, roleSpecificClauses,
      dataCollected, complianceFrameworks, dataRetentionPolicy,
      cookiePolicy, thirdPartySharing, geolocationTracking,
    } = req.body;

    const existing = await PrivacyPolicy.findOne({ version });
    if (existing) {
      return res.status(400).json({ success: false, message: `Version "${version}" already exists.` });
    }

    const policy = await PrivacyPolicy.create({
      version, title, slug, content, summary, effectiveDate, changeLog,
      requiresReAcceptance, applicableRoles, roleSpecificClauses,
      dataCollected, complianceFrameworks, dataRetentionPolicy,
      cookiePolicy, thirdPartySharing, geolocationTracking,
      isActive: false,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PATCH /api/legal/privacy/:id
 * @desc    Update a draft Privacy Policy version
 * @access  Private [superadmin, admin]
 */
router.patch('/privacy/:id', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: 'Privacy Policy not found.' });

    if (policy.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit an active Privacy Policy. Create a new version instead.',
      });
    }

    const allowedFields = [
      'title', 'slug', 'content', 'summary', 'effectiveDate', 'changeLog',
      'requiresReAcceptance', 'applicableRoles', 'roleSpecificClauses',
      'dataCollected', 'complianceFrameworks', 'dataRetentionPolicy',
      'cookiePolicy', 'thirdPartySharing', 'geolocationTracking',
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) policy[field] = req.body[field];
    });
    policy.updatedBy = req.user._id;

    await policy.save();
    res.status(200).json({ success: true, data: policy });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PATCH /api/legal/privacy/:id/publish
 * @desc    Publish (activate) a Privacy Policy version
 * @access  Private [superadmin]
 */
router.patch('/privacy/:id/publish', protect, authorize('superadmin'), async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: 'Privacy Policy not found.' });
    if (policy.isActive) return res.status(400).json({ success: false, message: 'Already active.' });

    const current = await PrivacyPolicy.findOne({ isActive: true });
    if (current) {
      policy.previousVersions.push({
        version: current.version,
        content: current.content,
        publishedAt: current.publishedAt || current.createdAt,
        publishedBy: current.publishedBy,
        changeLog: current.changeLog,
      });
    }

    policy.isActive = true;
    policy.publishedBy = req.user._id;
    policy.updatedBy = req.user._id;
    await policy.save();

    res.status(200).json({ success: true, message: `Privacy Policy v${policy.version} is now active.`, data: policy });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/legal/privacy/:id
 * @desc    Delete a DRAFT Privacy Policy version
 * @access  Private [superadmin]
 */
router.delete('/privacy/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    const policy = await PrivacyPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: 'Privacy Policy not found.' });
    if (policy.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot delete an active Privacy Policy.' });
    }
    await policy.deleteOne();
    res.status(200).json({ success: true, message: 'Draft Privacy Policy version deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// USER CONSENT ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/legal/consent
 * @desc    Record user's acceptance of Terms and/or Privacy Policy
 * @access  Private [all authenticated users]
 * @body    { method, platform, deviceName }
 */
router.post('/consent', protect, async (req, res) => {
  try {
    const { method = 'explicit_checkbox', platform = 'web', deviceName } = req.body;

    const [activeTerms, activePolicy] = await Promise.all([
      TermsAndConditions.findOne({ isActive: true }).select('_id version'),
      PrivacyPolicy.findOne({ isActive: true }).select('_id version'),
    ]);

    if (!activeTerms || !activePolicy) {
      return res.status(400).json({ success: false, message: 'No active legal documents to consent to.' });
    }

    const consent = await UserConsent.create({
      user: req.user._id,
      userRole: req.user.role,
      termsVersion: activeTerms._id,
      termsVersionNumber: activeTerms.version,
      privacyPolicyVersion: activePolicy._id,
      privacyPolicyVersionNumber: activePolicy.version,
      method,
      platform,
      deviceName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      acceptedAt: new Date(),
    });

    // Sync acceptance timestamps back onto the User document
    await req.user.constructor.findByIdAndUpdate(req.user._id, {
      termsAcceptedAt: consent.acceptedAt,
      privacyPolicyAcceptedAt: consent.acceptedAt,
    });

    res.status(201).json({ success: true, message: 'Consent recorded.', data: consent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/legal/consent/me
 * @desc    Get current user's consent history
 * @access  Private [all authenticated users]
 */
router.get('/consent/me', protect, async (req, res) => {
  try {
    const consents = await UserConsent.find({ user: req.user._id })
      .sort({ acceptedAt: -1 })
      .lean();

    res.status(200).json({ success: true, count: consents.length, data: consents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/legal/consent/status
 * @desc    Check if the current user has accepted the latest active documents
 * @access  Private [all authenticated users]
 */
router.get('/consent/status', protect, async (req, res) => {
  try {
    const [activeTerms, activePolicy] = await Promise.all([
      TermsAndConditions.findOne({ isActive: true }).select('_id version effectiveDate requiresReAcceptance'),
      PrivacyPolicy.findOne({ isActive: true }).select('_id version effectiveDate requiresReAcceptance'),
    ]);

    const termsAccepted = activeTerms
      ? req.user.termsAcceptedAt >= activeTerms.effectiveDate
      : false;

    const privacyAccepted = activePolicy
      ? req.user.privacyPolicyAcceptedAt >= activePolicy.effectiveDate
      : false;

    res.status(200).json({
      success: true,
      data: {
        termsAccepted,
        privacyAccepted,
        consentRequired: !termsAccepted || !privacyAccepted,
        activeTermsVersion: activeTerms?.version || null,
        activePrivacyVersion: activePolicy?.version || null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/legal/consent/users
 * @desc    Get all users' consent records (admin only) — with pagination & filter
 * @access  Private [superadmin, admin]
 * @query   ?userId=&platform=&method=&page=&limit=
 */
router.get('/consent/users', protect, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { userId, platform, method, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (userId) filter.user = userId;
    if (platform) filter.platform = platform;
    if (method) filter.method = method;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [consents, total] = await Promise.all([
      UserConsent.find(filter)
        .populate('user', 'name email role')
        .sort({ acceptedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserConsent.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: consents,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PATCH /api/legal/consent/:id/withdraw
 * @desc    GDPR: Withdraw consent (marks record, does not delete)
 * @access  Private [authenticated user — own record only, or superadmin]
 * @body    { reason }
 */
router.patch('/consent/:id/withdraw', protect, async (req, res) => {
  try {
    const consent = await UserConsent.findById(req.params.id);
    if (!consent) return res.status(404).json({ success: false, message: 'Consent record not found.' });

    const isOwner = consent.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'superadmin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to withdraw this consent.' });
    }

    if (consent.isWithdrawn) {
      return res.status(400).json({ success: false, message: 'Consent already withdrawn.' });
    }

    consent.isWithdrawn = true;
    consent.withdrawnAt = new Date();
    consent.withdrawalReason = req.body.reason || 'No reason provided';
    await consent.save();

    res.status(200).json({ success: true, message: 'Consent withdrawn.', data: consent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


export default router;