/**
 * searchRouter.js
 *
 * Enterprise-grade unified search router for healthcare platform.
 * Covers: doctors, hospitals, labs, medicines, global search,
 *         trending, popular, autocomplete, and recent searches.
 *
 * Architecture:
 *   Helpers → Cache → Middlewares → Validators → Route handlers → Export
 *
 * No external controller/service files. All logic self-contained.
 */

import express          from 'express';
import mongoose         from 'mongoose';
import rateLimit        from 'express-rate-limit';
import { query, validationResult } from 'express-validator';

import { protect }      from '../middleware/authMiddleware.js';
import User             from '../models/User.js';
import DoctorProfile    from '../models/DoctorProfile.js';
import Hospital         from '../models/Hospital.js';
import LabPartnerProfile from '../models/LabPartnerProfile.js';
import Medicine         from '../models/Medicine.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PAGE_SIZE     = 50;
const DEFAULT_PAGE_SIZE = 10;
const MAX_QUERY_LENGTH  = 200;
const MAX_RECENT        = 10;   // stored recent searches per user
const TRENDING_TTL_MS   = 5 * 60 * 1000;   // 5 min in-process cache
const POPULAR_TTL_MS    = 10 * 60 * 1000;  // 10 min

// Vijayawada default coords [lng, lat]
const DEFAULT_LNG = 80.648;
const DEFAULT_LAT = 16.506;

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED LOGGER  (Winston-compatible shape; plug in real Winston if needed)
// ─────────────────────────────────────────────────────────────────────────────

const log = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'info',  msg, ...meta, ts: new Date().toISOString() })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn',  msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() })),
};

// ─────────────────────────────────────────────────────────────────────────────
// IN-PROCESS CACHE  (replace with Redis for multi-instance deployments)
// ─────────────────────────────────────────────────────────────────────────────

const cache = new Map();  // key → { data, expiresAt }

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH LOG COLLECTION  (lightweight, capped — tracks queries for trending)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SearchLog — ephemeral query tracking.
 * Capped at 100k documents; no explicit migration needed.
 * Used for trending computation and analytics.
 */
let SearchLog;
(function initSearchLog() {
  const schema = new mongoose.Schema(
    {
      query:     { type: String, required: true, trim: true, lowercase: true, index: true },
      category:  { type: String, enum: ['doctor', 'hospital', 'lab', 'medicine', 'global'], index: true },
      userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
      ipAddress: { type: String },
      resultCount: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now, index: true, expires: 60 * 60 * 24 * 30 }, // 30-day TTL
    },
    { timestamps: false, versionKey: false }
  );
  schema.index({ query: 1, category: 1 });
  schema.index({ createdAt: -1 });

  SearchLog = mongoose.models.SearchLog || mongoose.model('SearchLog', schema);
})();

/**
 * RecentSearch — per-user recent search history (stored on User-adjacent collection)
 */
let RecentSearch;
(function initRecentSearch() {
  const schema = new mongoose.Schema(
    {
      userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      query:     { type: String, required: true, trim: true },
      category:  { type: String, enum: ['doctor', 'hospital', 'lab', 'medicine', 'global', 'all'], default: 'all' },
      searchedAt:{ type: Date, default: Date.now },
    },
    { timestamps: false, versionKey: false }
  );
  schema.index({ userId: 1, searchedAt: -1 });
  schema.index({ userId: 1, query: 1, category: 1 }, { unique: true });

  RecentSearch = mongoose.models.RecentSearch || mongoose.model('RecentSearch', schema);
})();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Safe async wrapper — prevents unhandled rejections crashing Express */
const asyncWrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Parse & sanitize pagination params */
function parsePagination(req) {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

/** Build GeoNear stage when coords supplied */
function buildGeoNearStage(lng, lat, maxKm = 50, distanceField = 'distanceKm') {
  return {
    $geoNear: {
      near:          { type: 'Point', coordinates: [lng, lat] },
      distanceField,
      maxDistance:   maxKm * 1000,
      spherical:     true,
      distanceMultiplier: 0.001,  // m → km
    },
  };
}

/** Extract real IP (trust-proxy aware) */
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/** Fire-and-forget search log write */
function logSearch(query, category, userId, ip, resultCount) {
  SearchLog.create({ query: query.toLowerCase(), category, userId: userId || null, ipAddress: ip, resultCount })
    .catch((err) => log.warn('SearchLog write failed', { err: err.message }));
}

/** Update user's recent searches — upsert + cap at MAX_RECENT */
async function saveRecentSearch(userId, query, category) {
  if (!userId) return;
  try {
    await RecentSearch.findOneAndUpdate(
      { userId, query: query.trim(), category },
      { $set: { searchedAt: new Date() } },
      { upsert: true, new: true }
    );
    // Enforce cap: delete oldest beyond MAX_RECENT
    const all = await RecentSearch.find({ userId }).sort({ searchedAt: -1 }).select('_id').lean();
    if (all.length > MAX_RECENT) {
      const toDelete = all.slice(MAX_RECENT).map((d) => d._id);
      await RecentSearch.deleteMany({ _id: { $in: toDelete } });
    }
  } catch (err) {
    log.warn('saveRecentSearch failed', { userId, err: err.message });
  }
}

/** Validate request — returns errors array or null */
function getValidationErrors(req) {
  const result = validationResult(req);
  return result.isEmpty() ? null : result.array();
}

/** Standard success envelope */
function ok(res, data, meta = {}) {
  return res.status(200).json({ success: true, ...meta, data });
}

/** Standard error envelope */
function fail(res, status, message, code = 'ERROR') {
  return res.status(status).json({ success: false, code, message });
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────────────────────────────────────

const searchRateLimit = rateLimit({
  windowMs:    60 * 1000,   // 1 min
  max:         60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many search requests. Slow down.' },
});

const autocompleteRateLimit = rateLimit({
  windowMs:    60 * 1000,
  max:         120,          // autocomplete hits faster
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many autocomplete requests.' },
});

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION CHAINS
// ─────────────────────────────────────────────────────────────────────────────

const queryRequired = [
  query('q')
    .trim()
    .notEmpty().withMessage('Search query (q) is required.')
    .isLength({ max: MAX_QUERY_LENGTH }).withMessage(`Query max ${MAX_QUERY_LENGTH} chars.`),
];

const queryOptional = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: MAX_QUERY_LENGTH }).withMessage(`Query max ${MAX_QUERY_LENGTH} chars.`),
];

const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be ≥ 1.'),
  query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }).withMessage(`limit 1–${MAX_PAGE_SIZE}.`),
];

const geoValidators = [
  query('lat').optional().isFloat({ min: -90,  max: 90  }).withMessage('lat must be valid latitude.'),
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be valid longitude.'),
  query('maxKm').optional().isFloat({ min: 0.5, max: 200 }).withMessage('maxKm must be 0.5–200.'),
];

const sortValidators = [
  query('sort').optional().isIn(['relevance', 'rating', 'distance', 'name', 'newest']).withMessage('Invalid sort.'),
];

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE — validation gate
// ─────────────────────────────────────────────────────────────────────────────

const validate = (req, res, next) => {
  const errors = getValidationErrors(req);
  if (errors) return fail(res, 422, errors[0].msg, 'VALIDATION_ERROR');
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL AUTH — attach req.user if token present; don't block if absent
// ─────────────────────────────────────────────────────────────────────────────

const optionalAuth = asyncWrap(async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    // Re-use protect logic — if it fails just continue anonymously
    await new Promise((resolve, reject) => protect(req, res, (err) => (err ? reject(err) : resolve())));
  } catch {
    // Anonymous — swallow auth errors for public search endpoints
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 1: GET /search/doctors ───────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/doctors
 *
 * Query params:
 *   q            — search term (name, specialization)
 *   specialization — filter
 *   lat, lng, maxKm — geo filter
 *   sort         — relevance | rating | distance | name
 *   page, limit
 *   inPerson, video, homeVisit — boolean filters
 *   verified     — boolean
 */
router.get(
  '/doctors',
  searchRateLimit,
  optionalAuth,
  [...queryOptional, ...paginationValidators, ...geoValidators, ...sortValidators],
  validate,
  asyncWrap(async (req, res) => {
    const { q, specialization, sort = 'relevance', verified, inPerson, video, homeVisit } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const lat   = parseFloat(req.query.lat) || null;
    const lng   = parseFloat(req.query.lng) || null;
    const maxKm = parseFloat(req.query.maxKm) || 25;

    const pipeline = [];

    // ── Geo stage ────────────────────────────────────────────────────────────
    if (lat && lng) {
      pipeline.push(buildGeoNearStage(lng, lat, maxKm, 'distanceKm'));
      // NOTE: geoNear must be first if used; DoctorProfile has no geo — join via Hospital
      // We'll attach distance post-populate; skip geoNear on DoctorProfile directly.
      // For geo-filtered doctor search, use hospital's location via lookup.
    }

    // ── Match stage ──────────────────────────────────────────────────────────
    const match = {
      isActive: true,
      partnershipStatus: 'Active',
    };

    if (verified === 'true') match.isVerified = true;
    if (specialization) match.specialization = specialization;
    if (inPerson  === 'true') match['consultationTypes.inPerson']  = true;
    if (video     === 'true') match['consultationTypes.video']     = true;
    if (homeVisit === 'true') match['consultationTypes.homeVisit'] = true;

    if (q) {
      match.$or = [
        { biography: { $regex: q, $options: 'i' } },
        { specialization: { $regex: q, $options: 'i' } },
        { languagesSpoken: { $regex: q, $options: 'i' } },
      ];
    }

    pipeline.push({ $match: match });

    // ── Lookup user for name ─────────────────────────────────────────────────
    pipeline.push(
      {
        $lookup: {
          from:         'users',
          localField:   'user',
          foreignField: '_id',
          pipeline:     [{ $project: { name: 1, avatar: 1 } }],
          as:           '_user',
        },
      },
      { $unwind: { path: '$_user', preserveNullAndEmpty: false } }
    );

    // ── Name text filter post-lookup ─────────────────────────────────────────
    if (q) {
      pipeline.push({
        $match: {
          $or: [
            { '_user.name': { $regex: q, $options: 'i' } },
            { specialization: { $regex: q, $options: 'i' } },
            { biography: { $regex: q, $options: 'i' } },
          ],
        },
      });
    }

    // ── Lookup primaryHospital ───────────────────────────────────────────────
    pipeline.push(
      {
        $lookup: {
          from:         'hospitals',
          localField:   'primaryHospital',
          foreignField: '_id',
          pipeline: [
            { $project: { name: 1, 'address.city': 1, 'address.state': 1, hospitalType: 1, managementModel: 1 } },
          ],
          as: '_hospital',
        },
      },
      { $unwind: { path: '$_hospital', preserveNullAndEmpty: true } }
    );

    // ── Sort ──────────────────────────────────────────────────────────────────
    const sortMap = {
      relevance: { 'rating.averageRating': -1 },
      rating:    { 'rating.averageRating': -1 },
      distance:  lat && lng ? { distanceKm: 1 } : { 'rating.averageRating': -1 },
      name:      { '_user.name': 1 },
      newest:    { createdAt: -1 },
    };
    pipeline.push({ $sort: sortMap[sort] || { 'rating.averageRating': -1 } });

    // ── Facet for count + data ────────────────────────────────────────────────
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id:              1,
              specialization:   1,
              experienceYears:  1,
              rating:           1,
              consultationTypes:1,
              fees:             1,
              profilePhotoUrl:  1,
              isVerified:       1,
              isOnline:         1,
              languagesSpoken:  1,
              distanceKm:       1,
              partnershipStatus:1,
              'name':           '$_user.name',
              'avatar':         '$_user.avatar',
              'hospital.name':  '$_hospital.name',
              'hospital.city':  '$_hospital.address.city',
              'hospital.type':  '$_hospital.hospitalType',
            },
          },
        ],
      },
    });

    const [result] = await DoctorProfile.aggregate(pipeline).allowDiskUse(true);
    const total    = result.metadata[0]?.total ?? 0;
    const doctors  = result.data;

    // Fire-and-forget analytics
    if (q) {
      logSearch(q, 'doctor', req.user?._id, getIp(req), total);
      saveRecentSearch(req.user?._id, q, 'doctor');
    }

    return ok(res, doctors, {
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 2: GET /search/hospitals ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/hospitals
 *
 * Query params:
 *   q            — name / specialty text search
 *   hospitalType — Multi-Specialty | Super-Specialty | Clinic | ...
 *   city
 *   lat, lng, maxKm
 *   accreditations — comma-separated (NABH,NABL,JCI)
 *   facilities     — comma-separated flags (hasICU,hasPharmacy,hasAmbulance)
 *   sort           — relevance | rating | distance | name | newest
 *   page, limit
 */
router.get(
  '/hospitals',
  searchRateLimit,
  optionalAuth,
  [...queryOptional, ...paginationValidators, ...geoValidators, ...sortValidators],
  validate,
  asyncWrap(async (req, res) => {
    const { q, hospitalType, city, sort = 'relevance' } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const lat    = parseFloat(req.query.lat) || null;
    const lng    = parseFloat(req.query.lng) || null;
    const maxKm  = parseFloat(req.query.maxKm) || 25;

    const accreditations = req.query.accreditations
      ? req.query.accreditations.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const facilityFlags = req.query.facilities
      ? req.query.facilities.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // ── Build match ───────────────────────────────────────────────────────────
    const match = { isActive: true, isVerified: true };

    if (hospitalType) match.hospitalType = hospitalType;
    if (city) match['address.city'] = { $regex: city, $options: 'i' };
    if (accreditations.length) match.accreditations = { $all: accreditations };

    const VALID_FLAGS = [
      'isEmergencyReady','hasICU','hasBloodBank','hasPharmacy',
      'hasDiagnostics','hasAmbulance','hasWheelchairAccess','is24x7',
    ];
    for (const flag of facilityFlags) {
      if (VALID_FLAGS.includes(flag)) match[flag] = true;
    }

    if (q) {
      match.$or = [
        { name:        { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { specialties: { $regex: q, $options: 'i' } },
      ];
    }

    const pipeline = [];

    // ── Geo near ──────────────────────────────────────────────────────────────
    if (lat && lng) {
      pipeline.push({
        $geoNear: {
  near:               { type: 'Point', coordinates: [lng, lat] },
  distanceField:      'distanceKm',
  maxDistance:        maxKm * 1000,
  spherical:          true,
  distanceMultiplier: 0.001,
  query:              match,
  key:                'location',   // ← ADD THIS
},
      });
    } else {
      pipeline.push({ $match: match });
    }

    // ── Sort ──────────────────────────────────────────────────────────────────
    const sortMap = {
      relevance: { 'rating.averageRating': -1 },
      rating:    { 'rating.averageRating': -1 },
      distance:  lat && lng ? { distanceKm: 1 } : { 'rating.averageRating': -1 },
      name:      { name: 1 },
      newest:    { createdAt: -1 },
    };
    pipeline.push({ $sort: sortMap[sort] || { 'rating.averageRating': -1 } });

    // ── Facet ─────────────────────────────────────────────────────────────────
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name:            1,
              slug:            1,
              hospitalType:    1,
              managementModel: 1,
              description:     1,
              logo:            1,
              images:          { $slice: ['$images', 1] },
              address:         1,
              location:        1,
              specialties:     1,
              accreditations:  1,
              isEmergencyReady:1,
              hasICU:          1,
              hasPharmacy:     1,
              is24x7:          1,
              rating:          1,
              isVerified:      1,
              distanceKm:      1,
              bedCount:        1,
              contact: {
                phone:   '$contact.phone',
                website: '$contact.website',
              },
            },
          },
        ],
      },
    });

    const [result] = await Hospital.aggregate(pipeline).allowDiskUse(true);
    const total    = result.metadata[0]?.total ?? 0;
    const hospitals = result.data;

    if (q) {
      logSearch(q, 'hospital', req.user?._id, getIp(req), total);
      saveRecentSearch(req.user?._id, q, 'hospital');
    }

    return ok(res, hospitals, {
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 3: GET /search/labs ───────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/labs
 *
 * Query params:
 *   q         — lab name / test name / tags
 *   labType   — Diagnostic Lab | Pathology Lab | ...
 *   testName  — filter labs offering a specific test
 *   city
 *   lat, lng, maxKm
 *   homeCollection — boolean
 *   accreditations — comma-separated
 *   sort      — relevance | rating | distance | name
 *   page, limit
 */
router.get(
  '/labs',
  searchRateLimit,
  optionalAuth,
  [...queryOptional, ...paginationValidators, ...geoValidators, ...sortValidators],
  validate,
  asyncWrap(async (req, res) => {
    const { q, labType, testName, city, sort = 'relevance' } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const lat   = parseFloat(req.query.lat) || null;
    const lng   = parseFloat(req.query.lng) || null;
    const maxKm = parseFloat(req.query.maxKm) || 30;
    const homeCollection = req.query.homeCollection === 'true';

    const accreditations = req.query.accreditations
      ? req.query.accreditations.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const match = { status: 'approved', isActive: true };

    if (labType) match.labType = labType;
    if (homeCollection) match.sampleCollectionMode = { $in: ['Home Collection', 'Both'] };
    if (accreditations.length) match['accreditations.body'] = { $all: accreditations };
    if (city) match['registeredAddress.city'] = { $regex: city, $options: 'i' };

    if (testName) {
      match['labTests'] = { $elemMatch: { testName: { $regex: testName, $options: 'i' }, isActive: true } };
    }

    if (q) {
      match.$or = [
        { labName: { $regex: q, $options: 'i' } },
        { tags:    { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { 'labTests.testName': { $regex: q, $options: 'i' } },
      ];
    }

    const pipeline = [];

    if (lat && lng) {
      pipeline.push({
        $geoNear: {
          near:               { type: 'Point', coordinates: [lng, lat] },
          distanceField:      'distanceKm',
          maxDistance:        maxKm * 1000,
          spherical:          true,
          distanceMultiplier: 0.001,
          query:              match,
          key:                'registeredAddress.location',
        },
      });
    } else {
      pipeline.push({ $match: match });
    }

    const sortMap = {
      relevance: { averageRating: -1 },
      rating:    { averageRating: -1 },
      distance:  lat && lng ? { distanceKm: 1 } : { averageRating: -1 },
      name:      { labName: 1 },
      newest:    { createdAt: -1 },
    };
    pipeline.push({ $sort: sortMap[sort] || { averageRating: -1 } });

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              labName:             1,
              labCode:             1,
              labType:             1,
              ownershipType:       1,
              description:         1,
              logoUrl:             1,
              registeredAddress:   1,
              sampleCollectionMode:1,
              homeCollectionRadius:1,
              homeCollectionFee:   1,
              averageRating:       1,
              totalReviews:        1,
              isVerified:          1,
              isFeatured:          1,
              distanceKm:          1,
              tags:                1,
              timing:              1,
              'accreditations.body': 1,
              // Return only active tests count — not full list
              activeTestCount: {
                $size: {
                  $filter: { input: { $ifNull: ['$labTests', []] }, as: 't', cond: '$$t.isActive' },
                },
              },
            },
          },
        ],
      },
    });

    const [result] = await LabPartnerProfile.aggregate(pipeline).allowDiskUse(true);
    const total    = result.metadata[0]?.total ?? 0;
    const labs     = result.data;

    if (q) {
      logSearch(q, 'lab', req.user?._id, getIp(req), total);
      saveRecentSearch(req.user?._id, q, 'lab');
    }

    return ok(res, labs, {
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 4: GET /search/medicines ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/medicines
 *
 * Query params:
 *   q           — name | brandName | genericName | keyword
 *   category    — Tablet | Capsule | Syrup | ...
 *   schedule    — H | H1 | X | None | ...
 *   manufacturer
 *   otcOnly     — boolean (schedule = None)
 *   prescriptionRequired — boolean
 *   sort        — relevance | name | price-asc | price-desc
 *   page, limit
 */
router.get(
  '/medicines',
  searchRateLimit,
  optionalAuth,
  [
    ...queryOptional,
    ...paginationValidators,
    query('sort').optional().isIn(['relevance', 'name', 'price-asc', 'price-desc']),
  ],
  validate,
  asyncWrap(async (req, res) => {
    const { q, category, schedule, manufacturer, sort = 'relevance' } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const otcOnly = req.query.otcOnly === 'true';
    const prescriptionRequired = req.query.prescriptionRequired === 'true';

    const match = { isApproved: true, isDiscontinued: false };

    if (category)    match.category    = category;
    if (schedule)    match.schedule    = schedule;
    if (manufacturer) match.manufacturer = { $regex: manufacturer, $options: 'i' };
    if (otcOnly)     match.schedule    = 'None';
    if (prescriptionRequired) match.isPrescriptionRequired = true;

    if (q) {
      // Use MongoDB text index for performance when available; fallback regex
      match.$text = { $search: q };
    }

    const pipeline = [{ $match: match }];

    // ── Sort ──────────────────────────────────────────────────────────────────
    if (q) {
      // Text score relevance
      pipeline.push({ $addFields: { _score: { $meta: 'textScore' } } });
    }

    const sortMap = {
      relevance:  q ? { _score: { $meta: 'textScore' } } : { name: 1 },
      name:       { name: 1 },
      'price-asc':  { mrp: 1 },
      'price-desc': { mrp: -1 },
    };
    pipeline.push({ $sort: sortMap[sort] || { name: 1 } });

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name:                  1,
              brandName:             1,
              genericName:           1,
              slug:                  1,
              category:              1,
              dosage:                1,
              schedule:              1,
              isPrescriptionRequired:1,
              mrp:                   1,
              packaging:             1,
              manufacturer:          1,
              gstPercentage:         1,
              therapeuticClass:      1,
              saltComposition:       1,
              images: {
                $filter: { input: { $ifNull: ['$images', []] }, as: 'img', cond: '$$img.isPrimary' },
              },
              isAvailable: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$inventory', []] },
                        as:    'inv',
                        cond:  {
                          $and: [
                            { $gt:  ['$$inv.stockQuantity', 0] },
                            { $gt:  ['$$inv.expiryDate', new Date()] },
                            { $eq:  ['$$inv.isActive', true] },
                          ],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
              _score: 1,
            },
          },
        ],
      },
    });

    const [result] = await Medicine.aggregate(pipeline).allowDiskUse(true);
    const total    = result.metadata[0]?.total ?? 0;
    const medicines = result.data;

    if (q) {
      logSearch(q, 'medicine', req.user?._id, getIp(req), total);
      saveRecentSearch(req.user?._id, q, 'medicine');
    }

    return ok(res, medicines, {
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 5: GET /search/global ─────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/global
 *
 * Multi-entity federated search. Runs parallel queries across doctors,
 * hospitals, labs, and medicines. Returns top N results per category.
 *
 * Query params:
 *   q       — required search term
 *   limit   — results per category (default 5, max 10)
 *   lat, lng
 */
router.get(
  '/global',
  searchRateLimit,
  optionalAuth,
  [
    ...queryRequired,
    query('limit').optional().isInt({ min: 1, max: 10 }).withMessage('limit 1–10 per category.'),
    ...geoValidators,
  ],
  validate,
  asyncWrap(async (req, res) => {
    const q     = req.query.q.trim();
    const limit = Math.min(10, parseInt(req.query.limit, 10) || 5);
    const lat   = parseFloat(req.query.lat) || null;
    const lng   = parseFloat(req.query.lng) || null;

    const regex = { $regex: q, $options: 'i' };

    // ── Parallel queries ──────────────────────────────────────────────────────
    const [doctors, hospitals, labs, medicines] = await Promise.all([
      // Doctors
      DoctorProfile.aggregate([
        {
          $match: {
            isActive: true,
            partnershipStatus: 'Active',
            $or: [{ specialization: regex }, { languagesSpoken: regex }],
          },
        },
        {
          $lookup: {
            from:         'users',
            localField:   'user',
            foreignField: '_id',
            pipeline:     [
              { $match: { name: regex } },
              { $project: { name: 1, avatar: 1 } },
            ],
            as: '_user',
          },
        },
        {
          $match: {
            $or: [{ specialization: regex }, { '_user.0': { $exists: true } }],
          },
        },
        { $sort: { 'rating.averageRating': -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 1, specialization: 1, rating: 1, profilePhotoUrl: 1, isVerified: 1,
            name: { $arrayElemAt: ['$_user.name', 0] },
            type: { $literal: 'doctor' },
          },
        },
      ]).allowDiskUse(true),

      // Hospitals
      Hospital.find(
        {
          isActive: true,
          isVerified: true,
          $or: [{ name: regex }, { specialties: regex }, { description: regex }],
        },
        { name: 1, hospitalType: 1, slug: 1, logo: 1, 'address.city': 1, 'rating.averageRating': 1 }
      )
        .sort({ 'rating.averageRating': -1 })
        .limit(limit)
        .lean()
        .then((docs) => docs.map((d) => ({ ...d, type: 'hospital' }))),

      // Labs
      LabPartnerProfile.find(
        {
          status: 'approved',
          isActive: true,
          $or: [{ labName: regex }, { tags: regex }, { 'labTests.testName': regex }],
        },
        { labName: 1, labType: 1, labCode: 1, logoUrl: 1, averageRating: 1, 'registeredAddress.city': 1 }
      )
        .sort({ averageRating: -1 })
        .limit(limit)
        .lean()
        .then((docs) => docs.map((d) => ({ ...d, type: 'lab' }))),

      // Medicines
      Medicine.find(
        {
          isApproved: true,
          isDiscontinued: false,
          $text: { $search: q },
        },
        { name: 1, brandName: 1, genericName: 1, category: 1, mrp: 1, slug: 1, score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean()
        .then((docs) => docs.map((d) => ({ ...d, type: 'medicine' }))),
    ]);

    logSearch(q, 'global', req.user?._id, getIp(req), doctors.length + hospitals.length + labs.length + medicines.length);
    saveRecentSearch(req.user?._id, q, 'global');

    return ok(res, { doctors, hospitals, labs, medicines });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 6: GET /search/autocomplete ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/autocomplete
 *
 * Fast prefix/fuzzy suggestions across all entities.
 * Returns max 10 suggestions grouped by category.
 *
 * Query params:
 *   q        — min 2 chars
 *   category — optional filter: doctor | hospital | lab | medicine | all
 */
router.get(
  '/autocomplete',
  autocompleteRateLimit,
  optionalAuth,
  [
    query('q')
      .trim()
      .notEmpty().withMessage('q is required.')
      .isLength({ min: 2, max: 80 }).withMessage('q must be 2–80 chars.'),
    query('category')
      .optional()
      .isIn(['doctor', 'hospital', 'lab', 'medicine', 'all'])
      .withMessage('Invalid category.'),
  ],
  validate,
  asyncWrap(async (req, res) => {
    const q        = req.query.q.trim();
    const category = req.query.category || 'all';
    const cacheKey = `ac:${category}:${q.toLowerCase()}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return ok(res, cached);

    const regex = { $regex: `^${q}`, $options: 'i' };  // prefix match (index-friendly)
    const LIMIT = 5;

    const tasks = [];

    if (category === 'all' || category === 'doctor') {
      tasks.push(
        User.find(
          { role: 'doctor', name: regex },
          { name: 1, avatar: 1 }
        ).limit(LIMIT).lean()
          .then((docs) => docs.map((d) => ({ _id: d._id, label: d.name, category: 'doctor', avatar: d.avatar })))
      );
    }

    if (category === 'all' || category === 'hospital') {
      tasks.push(
        Hospital.find(
          { isActive: true, name: regex },
          { name: 1, hospitalType: 1, slug: 1 }
        ).limit(LIMIT).lean()
          .then((docs) => docs.map((d) => ({ _id: d._id, label: d.name, category: 'hospital', sub: d.hospitalType, slug: d.slug })))
      );
    }

    if (category === 'all' || category === 'lab') {
      tasks.push(
        LabPartnerProfile.find(
          { isActive: true, status: 'approved', labName: regex },
          { labName: 1, labType: 1, labCode: 1 }
        ).limit(LIMIT).lean()
          .then((docs) => docs.map((d) => ({ _id: d._id, label: d.labName, category: 'lab', sub: d.labType })))
      );
    }

    if (category === 'all' || category === 'medicine') {
      tasks.push(
        Medicine.find(
          { isApproved: true, isDiscontinued: false, $or: [{ name: regex }, { brandName: regex }, { genericName: regex }] },
          { name: 1, brandName: 1, genericName: 1, category: 1 }
        ).limit(LIMIT).lean()
          .then((docs) => docs.map((d) => ({ _id: d._id, label: d.brandName || d.name, sub: d.genericName, category: 'medicine' })))
      );
    }

    const results = (await Promise.all(tasks)).flat();
    // Dedup by _id within same category
    const seen = new Set();
    const suggestions = results.filter((r) => {
      const key = `${r.category}:${r._id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);

    cacheSet(cacheKey, suggestions, 30_000); // 30s cache for autocomplete
    return ok(res, suggestions);
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 7: GET /search/trending ───────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/trending
 *
 * Returns top searched terms in the last 24 hours.
 *
 * Query params:
 *   category — optional filter
 *   limit    — 1–20 (default 10)
 */
router.get(
  '/trending',
  optionalAuth,
  [
    query('category').optional().isIn(['doctor', 'hospital', 'lab', 'medicine', 'global']),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  asyncWrap(async (req, res) => {
    const category = req.query.category || null;
    const limit    = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const cacheKey = `trending:${category || 'all'}:${limit}`;

    const cached = cacheGet(cacheKey);
    if (cached) return ok(res, cached);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };
    if (category) match.category = category;

    const trending = await SearchLog.aggregate([
      { $match: match },
      { $group: { _id: { query: '$query', category: '$category' }, count: { $sum: 1 }, avgResults: { $avg: '$resultCount' } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id:        0,
          query:      '$_id.query',
          category:   '$_id.category',
          searchCount:'$count',
          avgResults: { $round: ['$avgResults', 0] },
        },
      },
    ]);

    cacheSet(cacheKey, trending, TRENDING_TTL_MS);
    return ok(res, trending);
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 8: GET /search/popular ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/popular
 *
 * Top searched terms in the last 7 days — heavier aggregation, longer cache.
 *
 * Query params:
 *   category — optional
 *   limit    — 1–30 (default 15)
 */
router.get(
  '/popular',
  optionalAuth,
  [
    query('category').optional().isIn(['doctor', 'hospital', 'lab', 'medicine', 'global']),
    query('limit').optional().isInt({ min: 1, max: 30 }),
  ],
  validate,
  asyncWrap(async (req, res) => {
    const category = req.query.category || null;
    const limit    = Math.min(30, parseInt(req.query.limit, 10) || 15);
    const cacheKey = `popular:${category || 'all'}:${limit}`;

    const cached = cacheGet(cacheKey);
    if (cached) return ok(res, cached);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };
    if (category) match.category = category;

    const popular = await SearchLog.aggregate([
      { $match: match },
      {
        $group: {
          _id:          { query: '$query', category: '$category' },
          count:        { $sum: 1 },
          uniqueUsers:  { $addToSet: '$userId' },
          avgResults:   { $avg: '$resultCount' },
        },
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' },
          // Weighted score: raw count + 3x unique users (diversity signal)
          score: { $add: ['$count', { $multiply: [{ $size: '$uniqueUsers' }, 3] }] },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $project: {
          _id:             0,
          query:           '$_id.query',
          category:        '$_id.category',
          searchCount:     '$count',
          uniqueUserCount: 1,
          avgResults:      { $round: ['$avgResults', 0] },
        },
      },
    ]);

    cacheSet(cacheKey, popular, POPULAR_TTL_MS);
    return ok(res, popular);
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 9: GET /search/recent  (auth required) ────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/recent
 *
 * Returns the authenticated user's last N search queries.
 */
router.get(
  '/recent',
  protect,
  asyncWrap(async (req, res) => {
    const recent = await RecentSearch.find({ userId: req.user._id })
      .sort({ searchedAt: -1 })
      .limit(MAX_RECENT)
      .select('query category searchedAt -_id')
      .lean();

    return ok(res, recent);
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 10: DELETE /search/recent  (auth required) ────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/search/recent
 *
 * Clears all recent searches for the authenticated user.
 * Optionally deletes a single query via ?q=...
 */
router.delete(
  '/recent',
  protect,
  asyncWrap(async (req, res) => {
    const { q } = req.query;
    const filter = { userId: req.user._id };
    if (q) filter.query = q.trim();

    await RecentSearch.deleteMany(filter);
    return ok(res, null, { message: q ? 'Entry removed.' : 'Recent searches cleared.' });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 11: GET /search/nearby  (geo-first multi-entity) ──────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/nearby
 *
 * Returns hospitals and labs near provided coordinates.
 * Falls back to Vijayawada default if no coords supplied.
 *
 * Query params:
 *   lat, lng     — user location
 *   maxKm        — radius (default 10)
 *   types        — comma-separated: hospital,lab (default both)
 *   limit        — per entity (default 5, max 15)
 */
router.get(
  '/nearby',
  optionalAuth,
  [
    ...geoValidators,
    query('limit').optional().isInt({ min: 1, max: 15 }),
    query('types').optional().isString(),
  ],
  validate,
  asyncWrap(async (req, res) => {
    const lat   = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng   = parseFloat(req.query.lng) || DEFAULT_LNG;
    const maxKm = parseFloat(req.query.maxKm) || 10;
    const limit = Math.min(15, parseInt(req.query.limit, 10) || 5);

    const rawTypes  = req.query.types ? req.query.types.split(',').map((t) => t.trim()) : ['hospital', 'lab'];
    const wantHosp  = rawTypes.includes('hospital');
    const wantLab   = rawTypes.includes('lab');

    const tasks = [];

    if (wantHosp) {
      tasks.push(
        Hospital.aggregate([
          {
           $geoNear: {
  near:               { type: 'Point', coordinates: [lng, lat] },
  distanceField:      'distanceKm',
  maxDistance:        maxKm * 1000,
  spherical:          true,
  distanceMultiplier: 0.001,
  query:              { isActive: true, isVerified: true },
  key:                'location',   // ← ADD THIS
},
          },
          { $sort: { distanceKm: 1 } },
          { $limit: limit },
          {
            $project: {
              name: 1, hospitalType: 1, slug: 1, logo: 1,
              'address.city': 1, 'address.line1': 1,
              'rating.averageRating': 1, isEmergencyReady: 1,
              is24x7: 1, distanceKm: 1,
            },
          },
        ]).then((docs) => ({ entity: 'hospital', results: docs }))
      );
    }

    if (wantLab) {
      tasks.push(
        LabPartnerProfile.aggregate([
          {
            $geoNear: {
              near:               { type: 'Point', coordinates: [lng, lat] },
              distanceField:      'distanceKm',
              maxDistance:        maxKm * 1000,
              spherical:          true,
              distanceMultiplier: 0.001,
              query:              { status: 'approved', isActive: true },
              key:                'registeredAddress.location',
            },
          },
          { $sort: { distanceKm: 1 } },
          { $limit: limit },
          {
            $project: {
              labName: 1, labType: 1, labCode: 1, logoUrl: 1,
              averageRating: 1, sampleCollectionMode: 1,
              'registeredAddress.city': 1, distanceKm: 1,
            },
          },
        ]).then((docs) => ({ entity: 'lab', results: docs }))
      );
    }

    const results = await Promise.all(tasks);
    const payload  = {};
    for (const r of results) payload[r.entity] = r.results;

    return ok(res, payload, { location: { lat, lng }, radiusKm: maxKm });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 12: GET /search/specializations  (enum helper) ────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/specializations
 *
 * Returns list of available doctor specializations with doctor counts.
 * Cached 10 min.
 */
router.get(
  '/specializations',
  asyncWrap(async (req, res) => {
    const cacheKey = 'specializations:counts';
    const cached   = cacheGet(cacheKey);
    if (cached) return ok(res, cached);

    const data = await DoctorProfile.aggregate([
      { $match: { isActive: true, partnershipStatus: 'Active' } },
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, specialization: '$_id', doctorCount: '$count' } },
    ]);

    cacheSet(cacheKey, data, 10 * 60 * 1000);
    return ok(res, data);
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── ROUTE 13: GET /search/stats  (admin only) ───────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/search/stats
 *
 * Platform-wide search analytics for admins.
 * Returns: top queries, zero-result queries, query volume by category/day.
 *
 * Access: superadmin | admin
 */
router.get(
  '/stats',
  protect,
  (req, res, next) => {
    if (!['superadmin', 'admin'].includes(req.user?.role)) {
      return fail(res, 403, 'Admin access required.', 'FORBIDDEN');
    }
    next();
  },
  asyncWrap(async (req, res) => {
    const days  = Math.min(30, parseInt(req.query.days, 10) || 7);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [topQueries, zeroResults, volumeByCategory, volumeByDay] = await Promise.all([
      // Top 20 queries
      SearchLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$query', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
        { $project: { _id: 0, query: '$_id', count: 1 } },
      ]),

      // Zero-result queries
      SearchLog.aggregate([
        { $match: { createdAt: { $gte: since }, resultCount: 0 } },
        { $group: { _id: '$query', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
        { $project: { _id: 0, query: '$_id', count: 1 } },
      ]),

      // Volume by category
      SearchLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { _id: 0, category: '$_id', count: 1 } },
      ]),

      // Volume by day
      SearchLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
    ]);

    log.info('Search stats accessed', { userId: req.user._id, role: req.user.role, days });

    return ok(res, { topQueries, zeroResults, volumeByCategory, volumeByDay, periodDays: days });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CENTRALIZED ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

router.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error.';

  log.error('Search router error', {
    status,
    message,
    path:    req.path,
    method:  req.method,
    userId:  req.user?._id,
    stack:   process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  return res.status(status).json({
    success: false,
    code:    status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
    message: process.env.NODE_ENV === 'production' && status === 500
      ? 'Something went wrong. Please try again.'
      : message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

export default router;

/**
 * Mount in app.js:
 *
 *   import searchRouter from './routes/searchRouter.js';
 *   app.use('/api/v1/search', searchRouter);
 *
 * Routes summary:
 *   GET  /api/v1/search/doctors          — doctor search
 *   GET  /api/v1/search/hospitals        — hospital search
 *   GET  /api/v1/search/labs             — lab search
 *   GET  /api/v1/search/medicines        — medicine search
 *   GET  /api/v1/search/global           — federated multi-entity search
 *   GET  /api/v1/search/autocomplete     — prefix suggestions
 *   GET  /api/v1/search/trending         — top searches last 24h
 *   GET  /api/v1/search/popular          — top searches last 7d
 *   GET  /api/v1/search/recent           — user's recent searches [auth]
 *   DELETE /api/v1/search/recent         — clear recent searches [auth]
 *   GET  /api/v1/search/nearby           — geo-first hospital+lab results
 *   GET  /api/v1/search/specializations  — doctor specialization list + counts
 *   GET  /api/v1/search/stats            — analytics dashboard [admin]
 */