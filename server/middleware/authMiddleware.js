import jwt            from 'jsonwebtoken';
import DeviceDetector from 'device-detector-js';

import User             from '../models/User.js';
import PharmacyProfile  from '../models/PharmacyProfile.js';
import TransportPartner from '../models/TransportPartner.js';
// NOTE: TransportPartnerProfile removed.
//       attachTransportPartnerAgency now queries TransportPartner directly
//       using the user field, since User.profile virtual points to it.

const detector = new DeviceDetector();

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE INFO
// ─────────────────────────────────────────────────────────────────────────────

export const getDeviceInfo = (req, _res, next) => {
  const userAgentString = req.headers['user-agent'] || 'Unknown';
  const device          = detector.parse(userAgentString);

  let platform  = 'web';
  const osName  = device.os?.name?.toLowerCase()     || '';
  const devType = device.device?.type?.toLowerCase() || '';

  if (osName.includes('android')) {
    platform = 'android';
  } else if (
    osName.includes('ios') || osName.includes('iphone') || osName.includes('ipad')
  ) {
    platform = 'ios';
  } else if (
    osName.includes('windows') || osName.includes('mac') ||
    osName.includes('linux')   || osName.includes('ubuntu') ||
    osName.includes('debian')  || devType === 'desktop'
  ) {
    platform = 'desktop';
  }

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'Unknown';

  let deviceName = 'Unknown Device';
  if (device.device?.brand && device.device?.model) {
    deviceName = `${device.device.brand} ${device.device.model}`;
  } else if (device.os?.name) {
    deviceName = device.os.version
      ? `${device.os.name} ${device.os.version}`
      : device.os.name;
  } else if (device.client?.name) {
    deviceName = device.client.name;
  }

  req.deviceInfo = {
    userAgent: userAgentString,
    ipAddress: ip,
    deviceName,
    platform,
    _raw: {
      os:     device.os,
      client: device.client,
      device: device.device,
      bot:    device.bot,
    },
  };

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// PROTECT — JWT verification
// ─────────────────────────────────────────────────────────────────────────────

export const protect = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User associated with token no longer exists',
      });
    }

    if (user.isCurrentlyBlocked) {
      return res.status(403).json({
        success:     false,
        message:     'Your account is currently blocked',
        blockReason: user.blockReason,
        unblockAt:   user.unblockAt,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[protect] error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORIZE — Role guard
// ─────────────────────────────────────────────────────────────────────────────

export const authorize = (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success:  false,
        message:  `Access denied. Required roles: ${roles.join(', ')}`,
        userRole: req.user.role,
      });
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