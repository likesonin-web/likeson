import express       from 'express';
import LegalDocument  from '../models/Legaldocuments.js';
import { protect }    from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Cookie Categories ──────────────────────────────────────────────────────────
// essential = always true, cannot reject (site breaks without)
export const COOKIE_CATEGORIES = ['essential', 'analytics', 'marketing', 'functional'];

const DEFAULT_ACCEPT_ALL = {
  essential:  true,   // always on
  analytics:  true,
  marketing:  true,
  functional: true,
};

const DEFAULT_REJECT_ALL = {
  essential:  true,   // always on — cannot be false
  analytics:  false,
  marketing:  false,
  functional: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Fetch active cookie_policy doc. Throws 404 string if missing. */
const getActiveCookieDoc = async () => {
  const doc = await LegalDocument.findOne({
    documentType: 'cookie_policy',
    isPublished:  true,
    status:       'active',
    isDeleted:    false,
  }).sort({ effectiveDate: -1 });

  if (!doc) throw new Error('No active cookie policy found.');
  return doc;
};

/**
 * Find latest cookie consent record for user on given doc+version.
 * Returns the sub-doc or null.
 */
const findUserCookieConsent = (doc, userId, version) =>
  [...doc.consents]
    .reverse()
    .find(
      (c) =>
        c.userId.toString() === userId.toString() &&
        c.version           === version           &&
        !c.isWithdrawn
    ) ?? null;

/** Upsert cookie consent record into doc.consents */
const upsertCookieConsent = (doc, userId, version, payload) => {
  // Remove stale record for same user+version
  doc.consents = doc.consents.filter(
    (c) => !(c.userId.toString() === userId.toString() && c.version === version)
  );

  doc.consents.push({
    userId,
    version,
    consentedAt:       new Date(),
    ipAddress:         payload.ipAddress   ?? null,
    userAgent:         payload.userAgent   ?? null,
    platform:          payload.platform    ?? 'web',
    method:            'click',
    isWithdrawn:       false,
    state:             payload.state       ?? null,
    city:              payload.city        ?? null,
    // Cookie-specific fields stored in userAgent slot? No — extend via Object.assign
    // Stored as JSON string in a dedicated field below (cookiePreferences on sub-doc)
    cookiePreferences: payload.cookiePreferences,
  });

  doc.totalConsents += 1;
};

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/cookie-consent/policy
 * @desc    Get active cookie policy (public — shown in banner)
 * @access  Public
 */
router.get('/policy', async (req, res) => {
  try {
    const doc = await LegalDocument.findOne({
      documentType: 'cookie_policy',
      isPublished:  true,
      status:       'active',
      isDeleted:    false,
    })
      .select('title slug currentVersion effectiveDate summary keyPoints sections fullHtml')
      .sort({ effectiveDate: -1 })
      .lean();

    if (!doc) return res.status(404).json({ success: false, message: 'No active cookie policy found.' });

    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED — user cookie consent management
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/cookie-consent/status
 * @desc    Get current user's cookie consent status + preferences
 * @access  Private [all roles]
 * @returns {
 *   hasConsented: boolean,
 *   version: string,
 *   preferences: { essential, analytics, marketing, functional },
 *   consentedAt: Date | null
 * }
 */
router.get('/status', protect, async (req, res) => {
  try {
    const doc = await getActiveCookieDoc();

    const consent = findUserCookieConsent(doc, req.user._id, doc.currentVersion);

    if (!consent) {
      return res.status(200).json({
        success:      true,
        hasConsented: false,
        version:      doc.currentVersion,
        preferences:  null,
        consentedAt:  null,
        message:      'No cookie consent recorded for current version.',
      });
    }

    res.status(200).json({
      success:      true,
      hasConsented: true,
      version:      doc.currentVersion,
      preferences:  consent.cookiePreferences ?? DEFAULT_ACCEPT_ALL,
      consentedAt:  consent.consentedAt,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/cookie-consent/accept
 * @desc    Accept ALL cookie categories
 * @access  Private [all roles]
 * @body    { platform?, state?, city? }
 */
router.post('/accept', protect, async (req, res) => {
  try {
    const doc = await getActiveCookieDoc();
    const { platform = 'web', state, city } = req.body;

    const ip        = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                      ?? req.socket?.remoteAddress
                      ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    upsertCookieConsent(doc, req.user._id, doc.currentVersion, {
      ip, userAgent, platform, state, city,
      cookiePreferences: DEFAULT_ACCEPT_ALL,
    });

    await doc.save();

    res.status(201).json({
      success:     true,
      message:     'All cookies accepted.',
      version:     doc.currentVersion,
      preferences: DEFAULT_ACCEPT_ALL,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/cookie-consent/reject
 * @desc    Reject all non-essential cookies (essential stays true)
 * @access  Private [all roles]
 * @body    { platform?, state?, city? }
 */
router.post('/reject', protect, async (req, res) => {
  try {
    const doc = await getActiveCookieDoc();
    const { platform = 'web', state, city } = req.body;

    const ip        = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                      ?? req.socket?.remoteAddress
                      ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    upsertCookieConsent(doc, req.user._id, doc.currentVersion, {
      ip, userAgent, platform, state, city,
      cookiePreferences: DEFAULT_REJECT_ALL,
    });

    await doc.save();

    res.status(201).json({
      success:     true,
      message:     'Non-essential cookies rejected.',
      version:     doc.currentVersion,
      preferences: DEFAULT_REJECT_ALL,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * @route   PATCH /api/cookie-consent/settings
 * @desc    Granular cookie settings — toggle per category
 * @access  Private [all roles]
 * @body    {
 *   analytics?: boolean,
 *   marketing?: boolean,
 *   functional?: boolean,
 *   platform?: string,
 *   state?: string,
 *   city?: string
 * }
 * @note    essential always forced true — cannot be disabled
 */
router.patch('/settings', protect, async (req, res) => {
  try {
    const doc = await getActiveCookieDoc();

    const { analytics, marketing, functional, platform = 'web', state, city } = req.body;

    // Validate: must send at least one category
    const hasUpdate = [analytics, marketing, functional].some((v) => v !== undefined);
    if (!hasUpdate) {
      return res.status(400).json({
        success: false,
        message: 'Send at least one category: analytics, marketing, functional.',
      });
    }

    // Get existing prefs to merge (partial update)
    const existing = findUserCookieConsent(doc, req.user._id, doc.currentVersion);
    const prevPrefs = existing?.cookiePreferences ?? DEFAULT_REJECT_ALL;

    const newPrefs = {
      essential:  true,                                                          // locked
      analytics:  analytics  !== undefined ? Boolean(analytics)  : prevPrefs.analytics,
      marketing:  marketing  !== undefined ? Boolean(marketing)  : prevPrefs.marketing,
      functional: functional !== undefined ? Boolean(functional) : prevPrefs.functional,
    };

    const ip        = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                      ?? req.socket?.remoteAddress
                      ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    upsertCookieConsent(doc, req.user._id, doc.currentVersion, {
      ip, userAgent, platform, state, city,
      cookiePreferences: newPrefs,
    });

    await doc.save();

    res.status(200).json({
      success:     true,
      message:     'Cookie settings updated.',
      version:     doc.currentVersion,
      preferences: newPrefs,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * @route   DELETE /api/cookie-consent/withdraw
 * @desc    Withdraw cookie consent entirely (DPDP right)
 * @access  Private [all roles]
 */
router.delete('/withdraw', protect, async (req, res) => {
  try {
    const doc = await getActiveCookieDoc();

    const consent = findUserCookieConsent(doc, req.user._id, doc.currentVersion);
    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'No active cookie consent found for current version.',
      });
    }

    consent.isWithdrawn = true;
    consent.withdrawnAt = new Date();
    await doc.save();

    res.status(200).json({
      success: true,
      message: 'Cookie consent withdrawn. Only essential cookies will be used.',
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SCHEMA PATCH NOTE (add to consentSchema in Legaldocuments.js)
// ══════════════════════════════════════════════════════════════════════════════
/*
  Add inside consentSchema (before closing brace):

  cookiePreferences: {
    essential:  { type: Boolean, default: true },
    analytics:  { type: Boolean, default: false },
    marketing:  { type: Boolean, default: false },
    functional: { type: Boolean, default: false },
  },
*/

export default router;