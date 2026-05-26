/**
 * @file heroPageRoutes.js
 * @desc Enterprise-grade Hero Page router — all logic inline (no separate controller/service).
 * Supports: CRUD (admin/superadmin), public active-hero fetch, ImageKit media upload,
 * pagination, audit logging, role-based access, centralized error handling, and Redis Caching.
 *
 * Mount:  app.use('/api/v1/hero', heroPageRoutes);
 */

import express        from 'express';
import mongoose       from 'mongoose';
import multer         from 'multer';
import ImageKit       from 'imagekit';
import { protect, authorize } from '../middleware/authMiddleware.js';
import HeroPage       from '../models/HeroPage.js';
import cache          from '../middleware/cache.js'; 
import { invalidatePattern, invalidateKey } from '../utils/cacheInvalidation.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 0. CONSTANTS & CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ROLES  = ['superadmin', 'admin'];

// Set to 100 to allow files up to 100 MB (or change to 50 for a 50 MB limit)
const MAX_FILE_MB  = 100; 
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4',  'video/webm',
  'application/json', // Lottie
]);

// ─────────────────────────────────────────────────────────────────────────────
// 1. IMAGEKIT CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STRUCTURED LOGGER
// ─────────────────────────────────────────────────────────────────────────────

const log = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'info',  msg, ...meta, ts: new Date().toISOString() })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn',  msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() })),
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. ASYNC WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. REQUEST LOGGER MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

router.use((req, _res, next) => {
  log.info('Hero route hit', {
    method: req.method,
    path:   req.originalUrl,
    ip:     req.ip,
    userId: req.user?._id ?? 'unauthenticated',
  });
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MULTER
// ─────────────────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const sanitizeStr = (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

const validateCtaButton = (btn) => {
  if (!btn.label || !btn.href) return 'CTA button requires label and href';
  const VARIANTS = ['primary', 'secondary', 'outline', 'ghost'];
  if (btn.variant && !VARIANTS.includes(btn.variant)) return `Invalid CTA variant: ${btn.variant}`;
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const sendSuccess = (res, statusCode, message, data = {}) =>
  res.status(statusCode).json({ success: true, message, ...data });

const sendError = (res, statusCode, message, errors = null) =>
  res.status(statusCode).json({ success: false, message, ...(errors ? { errors } : {}) });

// ─────────────────────────────────────────────────────────────────────────────
// 8. AUDIT HELPER
// ─────────────────────────────────────────────────────────────────────────────

const audit = (action, userId, heroId, meta = {}) => {
  log.info('AUDIT', { action, userId: String(userId), heroId: String(heroId), ...meta });
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. IMAGEKIT UPLOAD HELPER
// ─────────────────────────────────────────────────────────────────────────────

const uploadToImageKit = (buffer, originalName, heroId) => {
  const folder   = `/hero-pages/${heroId}/`;
  const fileName = `${Date.now()}-${originalName.replace(/\s+/g, '_')}`;

  return new Promise((resolve, reject) => {
    imagekit.upload(
      { file: buffer, fileName, folder, useUniqueFileName: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. CACHE INVALIDATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wipes out public active hero caches, admin list caches, and optionally a specific hero's cache.
 */
const clearHeroCaches = async (heroId = null) => {
  await invalidatePattern('GET:/api/v1/hero*');
  if (heroId) {
    await invalidateKey(`hero:${heroId}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────  ROUTES  ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/hero/active
// Public — returns the single highest-priority, currently-visible hero.
// Cached for 5 minutes (300 seconds)
//
// BUG 1 FIX: duplicate $or key — JS objects can't have two keys named $or.
// The second $or silently overwrites the first, so the activeFrom filter was
// never applied. Wrapped both conditions inside $and so both are enforced.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/active',
  cache(300), 
  asyncHandler(async (req, res) => {
    const now = new Date();

    const hero = await HeroPage.findOne({
      isActive: true,
      // FIX: use $and to combine two separate $or clauses — previously the
      // second $or key overwrote the first in the plain JS object literal.
      $and: [
        { $or: [{ activeFrom: null }, { activeFrom: { $lte: now } }] },
        { $or: [{ activeTo:   null }, { activeTo:   { $gte: now } }] },
      ],
    })
      .sort({ priority: -1, createdAt: -1 })
      .select('-__v -createdBy -updatedBy')
      .lean();

    if (!hero) {
      return sendError(res, 404, 'No active hero page found');
    }

    return sendSuccess(res, 200, 'Active hero page fetched', { data: hero });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/hero
// Admin — paginated list of all hero pages with optional filters.
// Cached for 60 seconds based on query params
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/',
  protect,
  authorize(...ADMIN_ROLES),
  cache(60),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);

    // Optional filters
    const filter = {};
    if (typeof req.query.isActive !== 'undefined') {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ headline: regex }, { internalName: regex }];
    }

    const [heroes, total] = await Promise.all([
      HeroPage.find(filter)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean(),
      HeroPage.countDocuments(filter),
    ]);

    return sendSuccess(res, 200, 'Hero pages fetched', {
      data:       heroes,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/hero/:id
// Admin — fetch single hero page by ID.
// Cached using a custom key
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/:id',
  protect,
  authorize(...ADMIN_ROLES),
  cache(60, (req) => `hero:${req.params.id}`),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid hero page ID');
    }

    const hero = await HeroPage.findById(id).select('-__v').lean();
    if (!hero) return sendError(res, 404, 'Hero page not found');

    return sendSuccess(res, 200, 'Hero page fetched', { data: hero });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/hero
// Admin — create a new hero page (with optional media upload).
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/',
  protect,
  authorize(...ADMIN_ROLES),
  upload.single('mediaFile'),
  asyncHandler(async (req, res) => {
    const headline     = sanitizeStr(req.body.headline);
    const internalName = sanitizeStr(req.body.internalName);

    if (!headline)     return sendError(res, 400, 'headline is required');
    if (!internalName) return sendError(res, 400, 'internalName is required');

    let ctaButtons = [];
    if (req.body.ctaButtons) {
      try {
        ctaButtons = typeof req.body.ctaButtons === 'string'
          ? JSON.parse(req.body.ctaButtons)
          : req.body.ctaButtons;

        if (!Array.isArray(ctaButtons)) throw new Error();
      } catch {
        return sendError(res, 400, 'ctaButtons must be a valid JSON array');
      }

      for (const btn of ctaButtons) {
        const err = validateCtaButton(btn);
        if (err) return sendError(res, 400, err);
      }
    }

    let badge = null;
    if (req.body.badge) {
      try {
        badge = typeof req.body.badge === 'string'
          ? JSON.parse(req.body.badge)
          : req.body.badge;
        if (!badge.text) throw new Error('badge.text is required');
      } catch (e) {
        return sendError(res, 400, e.message || 'Invalid badge object');
      }
    }

    let seo = {};
    if (req.body.seo) {
      try {
        seo = typeof req.body.seo === 'string' ? JSON.parse(req.body.seo) : req.body.seo;
      } catch {
        return sendError(res, 400, 'Invalid seo object');
      }
    }

    const heroData = {
      internalName,
      headline,
      highlightedText: sanitizeStr(req.body.highlightedText),
      subheadline:     sanitizeStr(req.body.subheadline),
      description:     sanitizeStr(req.body.description),
      badge,
      ctaButtons,
      seo,
      isActive:    req.body.isActive    !== undefined ? req.body.isActive    === 'true' : true,
      priority:    parseInt(req.body.priority, 10) || 0,
      activeFrom:  req.body.activeFrom  ? new Date(req.body.activeFrom)  : null,
      activeTo:    req.body.activeTo    ? new Date(req.body.activeTo)    : null,
      analyticsTag: sanitizeStr(req.body.analyticsTag),
      createdBy:   req.user._id,
      updatedBy:   req.user._id,
    };

    if (req.file) {
      const tempId = new mongoose.Types.ObjectId().toString();
      const ikResult = await uploadToImageKit(req.file.buffer, req.file.originalname, tempId);

      const mediaType = req.file.mimetype.startsWith('video') ? 'video'
        : req.file.mimetype === 'application/json'           ? 'lottie'
        : 'image';

      heroData.media = {
        type:    mediaType,
        url:     ikResult.url,
        altText: sanitizeStr(req.body.mediaAltText) ?? '',
        poster:  sanitizeStr(req.body.mediaPoster),
        width:   parseInt(req.body.mediaWidth,  10) || undefined,
        height:  parseInt(req.body.mediaHeight, 10) || undefined,
      };
    } else if (req.body.mediaUrl) {
      const mediaType = req.body.mediaType ?? 'image';
      if (!['image', 'video', 'lottie'].includes(mediaType)) {
        return sendError(res, 400, 'mediaType must be image | video | lottie');
      }
      heroData.media = {
        type:    mediaType,
        url:     req.body.mediaUrl,
        altText: sanitizeStr(req.body.mediaAltText) ?? '',
        poster:  sanitizeStr(req.body.mediaPoster),
        width:   parseInt(req.body.mediaWidth,  10) || undefined,
        height:  parseInt(req.body.mediaHeight, 10) || undefined,
      };
    }

    const hero = await HeroPage.create(heroData);

    await clearHeroCaches(hero._id);

    audit('hero.create', req.user._id, hero._id, { internalName: hero.internalName });
    log.info('Hero page created', { heroId: hero._id, by: req.user._id });

    return sendSuccess(res, 201, 'Hero page created', { data: hero });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/hero/:id
// Admin — full / partial update of a hero page (with optional media re-upload).
// ─────────────────────────────────────────────────────────────────────────────

router.put(
  '/:id',
  protect,
  authorize(...ADMIN_ROLES),
  upload.single('mediaFile'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, 'Invalid hero page ID');

    const hero = await HeroPage.findById(id);
    if (!hero) return sendError(res, 404, 'Hero page not found');

    const fieldMap = {
      headline:        'headline',
      internalName:    'internalName',
      highlightedText: 'highlightedText',
      subheadline:     'subheadline',
      description:     'description',
      analyticsTag:    'analyticsTag',
    };
    for (const [bodyKey, schemaKey] of Object.entries(fieldMap)) {
      const val = sanitizeStr(req.body[bodyKey]);
      if (val !== undefined) hero[schemaKey] = val;
    }

    if (req.body.isActive  !== undefined) hero.isActive  = req.body.isActive  === 'true' || req.body.isActive  === true;
    if (req.body.priority  !== undefined) hero.priority  = parseInt(req.body.priority, 10) || 0;
    if (req.body.activeFrom !== undefined) hero.activeFrom = req.body.activeFrom ? new Date(req.body.activeFrom) : null;
    if (req.body.activeTo   !== undefined) hero.activeTo   = req.body.activeTo   ? new Date(req.body.activeTo)   : null;

    if (req.body.badge !== undefined) {
      if (req.body.badge === 'null' || req.body.badge === null) {
        hero.badge = null;
      } else {
        try {
          const badge = typeof req.body.badge === 'string'
            ? JSON.parse(req.body.badge) : req.body.badge;
          if (!badge.text) throw new Error('badge.text is required');
          hero.badge = badge;
        } catch (e) {
          return sendError(res, 400, e.message || 'Invalid badge object');
        }
      }
    }

    if (req.body.ctaButtons !== undefined) {
      try {
        const ctaButtons = typeof req.body.ctaButtons === 'string'
          ? JSON.parse(req.body.ctaButtons) : req.body.ctaButtons;
        if (!Array.isArray(ctaButtons)) throw new Error();

        for (const btn of ctaButtons) {
          const err = validateCtaButton(btn);
          if (err) return sendError(res, 400, err);
        }
        hero.ctaButtons = ctaButtons;
      } catch {
        return sendError(res, 400, 'ctaButtons must be a valid JSON array');
      }
    }

    if (req.body.seo !== undefined) {
      try {
        const seo = typeof req.body.seo === 'string' ? JSON.parse(req.body.seo) : req.body.seo;
        hero.seo = { ...hero.seo, ...seo };
      } catch {
        return sendError(res, 400, 'Invalid seo object');
      }
    }

    if (req.file) {
      const ikResult = await uploadToImageKit(req.file.buffer, req.file.originalname, id);

      const mediaType = req.file.mimetype.startsWith('video') ? 'video'
        : req.file.mimetype === 'application/json'           ? 'lottie'
        : 'image';

      hero.media = {
        type:    mediaType,
        url:     ikResult.url,
        altText: sanitizeStr(req.body.mediaAltText) ?? hero.media?.altText ?? '',
        poster:  sanitizeStr(req.body.mediaPoster)  ?? hero.media?.poster,
        width:   parseInt(req.body.mediaWidth,  10) || hero.media?.width,
        height:  parseInt(req.body.mediaHeight, 10) || hero.media?.height,
      };
    } else if (req.body.mediaUrl) {
      const mediaType = req.body.mediaType ?? hero.media?.type ?? 'image';
      if (!['image', 'video', 'lottie'].includes(mediaType)) {
        return sendError(res, 400, 'mediaType must be image | video | lottie');
      }
      hero.media = {
        ...(hero.media?.toObject?.() ?? hero.media ?? {}),
        type:    mediaType,
        url:     req.body.mediaUrl,
        altText: sanitizeStr(req.body.mediaAltText) ?? hero.media?.altText ?? '',
        poster:  sanitizeStr(req.body.mediaPoster)  ?? hero.media?.poster,
        width:   parseInt(req.body.mediaWidth,  10) || hero.media?.width,
        height:  parseInt(req.body.mediaHeight, 10) || hero.media?.height,
      };
    } else if (req.body.removeMedia === 'true') {
      hero.media = null;
    }

    hero.updatedBy = req.user._id;

    await hero.save();

    await clearHeroCaches(hero._id);

    audit('hero.update', req.user._id, hero._id, { internalName: hero.internalName });
    log.info('Hero page updated', { heroId: hero._id, by: req.user._id });

    return sendSuccess(res, 200, 'Hero page updated', { data: hero });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/hero/:id/toggle
// Admin — toggle isActive status quickly.
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  '/:id/toggle',
  protect,
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, 'Invalid hero page ID');

    const hero = await HeroPage.findById(id);
    if (!hero) return sendError(res, 404, 'Hero page not found');

    hero.isActive  = !hero.isActive;
    hero.updatedBy = req.user._id;
    await hero.save();

    await clearHeroCaches(hero._id);

    audit('hero.toggle', req.user._id, hero._id, { isActive: hero.isActive });
    log.info('Hero page toggled', { heroId: hero._id, isActive: hero.isActive, by: req.user._id });

    // BUG 7 FIX: return full hero fields (not just _id + isActive) so the Redux
    // slice can detect if the Mongoose pre-save hook auto-deactivated the record
    // due to an expired activeTo — the client now receives the source-of-truth.
    return sendSuccess(res, 200, `Hero page ${hero.isActive ? 'activated' : 'deactivated'}`, {
      data: { _id: hero._id, isActive: hero.isActive, activeTo: hero.activeTo, activeFrom: hero.activeFrom },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/hero/:id/priority
// Admin — update display priority only.
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  '/:id/priority',
  protect,
  authorize(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, 'Invalid hero page ID');

    const priority = parseInt(req.body.priority, 10);
    if (isNaN(priority)) return sendError(res, 400, 'priority must be a number');

    const hero = await HeroPage.findByIdAndUpdate(
      id,
      { priority, updatedBy: req.user._id },
      { new: true, runValidators: true, select: '_id internalName priority isActive' }
    );
    if (!hero) return sendError(res, 404, 'Hero page not found');

    await clearHeroCaches(hero._id);

    audit('hero.priority', req.user._id, hero._id, { priority });
    return sendSuccess(res, 200, 'Priority updated', { data: hero });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/hero/:id/media
// Admin — replace only the media asset (image/video/lottie) via ImageKit.
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:id/media',
  protect,
  authorize(...ADMIN_ROLES),
  upload.single('mediaFile'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, 'Invalid hero page ID');
    if (!req.file)             return sendError(res, 400, 'mediaFile is required');

    const hero = await HeroPage.findById(id);
    if (!hero) return sendError(res, 404, 'Hero page not found');

    const ikResult = await uploadToImageKit(req.file.buffer, req.file.originalname, id);

    const mediaType = req.file.mimetype.startsWith('video') ? 'video'
      : req.file.mimetype === 'application/json'           ? 'lottie'
      : 'image';

    hero.media = {
      type:    mediaType,
      url:     ikResult.url,
      altText: sanitizeStr(req.body.mediaAltText) ?? '',
      poster:  sanitizeStr(req.body.mediaPoster),
      width:   parseInt(req.body.mediaWidth,  10) || undefined,
      height:  parseInt(req.body.mediaHeight, 10) || undefined,
    };
    hero.updatedBy = req.user._id;
    await hero.save();

    await clearHeroCaches(hero._id);

    audit('hero.media.replace', req.user._id, hero._id, { mediaUrl: ikResult.url });
    log.info('Hero media replaced', { heroId: hero._id, url: ikResult.url, by: req.user._id });

    return sendSuccess(res, 200, 'Hero media updated', { data: hero.media });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/hero/:id
// Superadmin only — hard delete a hero page.
// ─────────────────────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  protect,
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, 'Invalid hero page ID');

    const hero = await HeroPage.findByIdAndDelete(id);
    if (!hero) return sendError(res, 404, 'Hero page not found');

    await clearHeroCaches(id);

    audit('hero.delete', req.user._id, id, { internalName: hero.internalName });
    log.warn('Hero page DELETED', { heroId: id, by: req.user._id });

    return sendSuccess(res, 200, 'Hero page deleted');
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/hero/imagekit/auth
// Authenticated — returns ImageKit client-side auth params (for direct upload).
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/imagekit/auth',
  protect,
  authorize(...ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    const authParams = imagekit.getAuthenticationParameters();
    return sendSuccess(res, 200, 'ImageKit auth params', { data: authParams });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. CENTRALIZED ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 413, `File exceeds the ${MAX_FILE_MB} MB limit`);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 422, 'Validation failed', errors);
  }

  if (err.name === 'CastError') {
    return sendError(res, 400, `Invalid value for field: ${err.path}`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] ?? 'field';
    return sendError(res, 409, `Duplicate value for ${field}`);
  }

  log.error('Unhandled route error', {
    message:  err.message,
    stack:    err.stack,
    method:   req.method,
    path:     req.originalUrl,
    userId:   req.user?._id ?? 'unauthenticated',
  });

  return sendError(
    res,
    err.statusCode ?? err.status ?? 500,
    err.isOperational ? err.message : 'Internal server error'
  );
});

export default router;