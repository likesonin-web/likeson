import jwt            from 'jsonwebtoken';
import DeviceDetector from 'device-detector-js';

import User             from '../models/User.js';
import PharmacyProfile  from '../models/PharmacyProfile.js';
import TransportPartner from '../models/TransportPartner.js';
import asyncHandler from '../utils/asyncHandler.js';
// NOTE: TransportPartnerProfile removed.
//       attachTransportPartnerAgency now queries TransportPartner directly
//       using the user field, since User.profile virtual points to it.

const detector = new DeviceDetector();
 
// ── getDeviceInfo middleware ──────────────────────────────────────────────────
export const getDeviceInfo = (req, _res, next) => {
  const ua     = req.headers['user-agent'] ?? '';
  const parsed = detector.parse(ua);
 
  req.deviceInfo = {
    userAgent:  ua,
    ipAddress:  (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      'Unknown'
    ),
    deviceName: [
      parsed.device?.brand,
      parsed.device?.model,
      parsed.os?.name,
    ].filter(Boolean).join(' ') || 'Unknown Device',
    platform: (() => {
      const os = (parsed.os?.name ?? '').toLowerCase();
      if (os.includes('android'))                          return 'android';
      if (os.includes('ios') || os.includes('mac'))        return 'ios';
      if (os.includes('windows') || os.includes('linux'))  return 'desktop';
      return 'web';
    })(),
    _raw: parsed,
  };
  next();
};
 
// ── protect middleware ────────────────────────────────────────────────────────
/**
 * FIX: Now extracts sessionId from JWT and validates it against
 * user.auditSessions. If the session no longer exists (was removed),
 * returns 401 so the client is forced to re-login.
 *
 * req.user is augmented with:
 *   req.user.sessionId  — the auditSession _id string from the JWT
 */
export const protect = asyncHandler(async (req, res, next) => {
  // 1. Extract token
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }
 
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated. Please log in.' });
  }
 
  // 2. Verify JWT
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired. Please log in again.' });
  }
 
  // 3. Load user — select auditSessions to check session validity
  const user = await User.findById(decoded.id).select('+auditSessions');
  if (!user) {
    return res.status(401).json({ message: 'User no longer exists.' });
  }
 
  // 4. FIX: Validate sessionId if present in the JWT
  //    Old tokens (without sessionId) bypass this check for backward compatibility.
  const sessionId = decoded.sessionId;
  if (sessionId) {
    const sessionExists = (user.auditSessions ?? []).some(
      (s) => s._id.toString() === sessionId
    );
    if (!sessionExists) {
      return res.status(401).json({
        message: 'Session has been revoked. Please log in again.',
        code:    'SESSION_REVOKED',
      });
    }
  }
 
  // 5. Check block status
  if (user.isCurrentlyBlocked) {
    return res.status(403).json({
      message:   'Account suspended.',
      reason:    user.blockReason,
      unblockAt: user.unblockAt,
    });
  }
 
  // 6. Attach user + sessionId to request
  req.user           = user;
  req.user.sessionId = sessionId ?? null;
 
  next();
});
 
// ── authorize middleware ──────────────────────────────────────────────────────
export const authorize = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: `Access denied. Required role: ${roles.join(' or ')}.` });
    }
    next();
  };

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY
// ─────────────────────────────────────────────────────────────────────────────

export const attachPharmacyStore = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role !== 'pharmacy') {
      return res.status(403).json({
        success:  false,
        message:  'Pharmacy profile required',
        userRole: req.user.role,
      });
    }

    const profile = await PharmacyProfile.findOne({ user: req.user._id })
      .populate('assignedStore');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy profile not found for this user',
      });
    }
    if (!profile.assignedStore) {
      return res.status(404).json({
        success:   false,
        message:   'No pharmacy store assigned to this profile',
        profileId: profile._id,
      });
    }

    req.pharmacy = { profile, store: profile.assignedStore };
    next();
  } catch (error) {
    console.error('[attachPharmacyStore] error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading pharmacy store details',
      error:   process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const pharmacyRoutes = [protect, authorize('pharmacy'), attachPharmacyStore];

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT PARTNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * attachTransportPartnerAgency
 *
 * FIX: TransportPartnerProfile removed.
 *
 * Previously this middleware loaded a TransportPartnerProfile document and
 * followed its `transportPartner` ref to get the agency. Now we query
 * TransportPartner directly using { user: req.user._id }, which is indexed.
 *
 * The middleware deliberately fetches only the minimal agency fields needed
 * for middleware-level decisions (partnershipStatus, isOnboardingComplete,
 * drivers[] for guard checks in the router). Individual route handlers
 * re-fetch and populate as needed — no N+1 here because the router's
 * queries are targeted.
 *
 * Sets req.transportPartner = { agency, agencyUnverified, onboardingIncomplete }
 */
export const attachTransportPartnerAgency = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role !== 'transportpartner') {
      return res.status(403).json({
        success:  false,
        message:  'Transport partner role required',
        userRole: req.user.role,
      });
    }

    // FIX: query TransportPartner directly — no TransportPartnerProfile lookup
    // Select only the fields the middleware and route guards actually need.
    // Route handlers fetch their own projections to avoid over-fetching.
    const agency = await TransportPartner.findOne({ user: req.user._id })
      .select(
        'partnershipStatus isOnboardingComplete isAvailable ' +
        'businessName rejectionReason drivers ' +
        'vehicles fleetInfo ownerKyc.kycStatus'
      );

    if (!agency) {
      return res.status(404).json({
        success: false,
        message: 'Transport partner business entity not found for this user. ' +
                 'Please contact support or complete onboarding.',
      });
    }

    // FIX: check partnershipStatus (not verificationStatus)
    if (agency.partnershipStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your transport agency has been suspended. Please contact support.',
        reason:  agency.rejectionReason || 'Administrative action',
      });
    }

    req.transportPartner = {
      agency,
      // Convenience flags for route handlers
      agencyUnverified:     agency.partnershipStatus !== 'active',
      onboardingIncomplete: !agency.isOnboardingComplete,
    };

    next();
  } catch (error) {
    console.error('[attachTransportPartnerAgency] error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading transport partner details',
      error:   process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Convenience pre-composed middleware stack for transport partner routes
export const transportPartnerRoutes = [
  protect,
  getDeviceInfo,
  authorize('transportpartner'),
  attachTransportPartnerAgency,
];