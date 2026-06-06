import express          from 'express';
import mongoose         from 'mongoose';
import Razorpay         from 'razorpay';
import multer           from 'multer';
import axios            from 'axios';
import FormData         from 'form-data';
import xlsx             from 'xlsx';
import * as pdfParse from 'pdf-parse';

import { protect, authorize, attachPharmacyStore } from '../../middleware/authMiddleware.js';
import PharmacyOrder    from '../../models/PharmacyOrder.js';
import PharmacyProfile  from '../../models/PharmacyProfile.js';
import PharmacyStore    from '../../models/PharmacyStore.js';
import HsnCode          from '../../models/HsnCode.js';
import Medicine         from '../../models/Medicine.js';
import User             from '../../models/User.js';
import Notification     from '../../models/Notification.js';
import Wallet           from '../../models/Wallet.js';
import PaymentAccount   from '../../models/PaymentAccount.js';
import SystemLog        from '../../models/SystemLog.js';
import sendEmail        from '../../utils/sendEmail.js';
import { generateDeliveryLabel } from '../../utils/deliveryLabel.utils.js';
import redisClient      from '../../config/redis.js';
import {
  buildStatusUpdateEmail,
  buildDeliveryOtpEmail,
  buildInvoiceHtml,
  buildRefundEmail,
  transactionalTemplate,
  buildStoreInvoiceHtml,
  buildLowStockAlertEmail,
  buildBatchExpiryAlertEmail,
  buildSettlementEmail,
} from '../../utils/emailTemplates.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// § RAZORPAY
// ═══════════════════════════════════════════════════════════════════════════════

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ═══════════════════════════════════════════════════════════════════════════════
// § CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ITEMS_PER_PAGE      = 20;
const MAX_ITEMS_PER_PAGE  = 100;
const LOW_STOCK_THRESHOLD = 5;
const EXPIRY_ALERT_DAYS   = 30;
const MAX_FILE_SIZE_MB    = 20;
const MAX_FILE_BYTES      = MAX_FILE_SIZE_MB * 1024 * 1024;
const VALID_GST_SLABS     = [0, 5, 12, 18, 28];

const IMAGEKIT = {
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  id:          process.env.IMAGEKITID,
  uploadUrl:   'https://upload.imagekit.io/api/v1/files/upload',
  folder:      '/likeson/hsn-uploads',
};

const HSN_COLUMN_ALIASES = {
  hsnCode:        ['hsn code', 'hsncode', 'hsn', 'code', 'hsn_code'],
  description:    ['description', 'desc', 'product description', 'item description'],
  chapterHeading: ['chapter heading', 'chapter', 'heading', 'chapter_heading'],
  gstPercentage:  ['gst %', 'gst%', 'gst percentage', 'tax %', 'rate', 'igst %', 'gst rate', 'tax rate'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// § MULTER
// ═══════════════════════════════════════════════════════════════════════════════

const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, _file, cb) => cb(null, true),
});

// ═══════════════════════════════════════════════════════════════════════════════
// § HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`❌ [${req.method} ${req.path}] ${err.message}`);
    next(err);
  });

const logAudit = (action, meta = {}) =>
  console.log(`[AUDIT][${new Date().toISOString()}] ${action}`, meta);

const logError = (action, err, ctx = {}) =>
  console.error(`[ERROR][${new Date().toISOString()}] ${action}: ${err.message}`, { stack: err.stack, ctx });

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Resolves an order by MongoDB _id or human-readable orderId string.
 * Returns a Mongoose document (NOT lean) so callers can call .save().
 */
const findOrderByIdOrString = async (orderId, storeId) => {
  if (!orderId) return null;
  const base    = { store: new mongoose.Types.ObjectId(storeId), isArchived: false };
  const isValid = mongoose.Types.ObjectId.isValid(orderId);
  try {
    if (!isValid) return await PharmacyOrder.findOne({ ...base, orderId });
    const byId = await PharmacyOrder.findOne({ ...base, _id: new mongoose.Types.ObjectId(orderId) });
    return byId || await PharmacyOrder.findOne({ ...base, orderId });
  } catch (err) {
    logError('FIND_ORDER_ERROR', err, { orderId });
    return null;
  }
};

/**
 * Like findOrderByIdOrString but with full population for read-only responses.
 * Returns a fully-populated Mongoose document with virtuals enabled.
 */
const findOrderPopulated = async (orderId, storeId) => {
  if (!orderId) return null;
  const base    = { store: new mongoose.Types.ObjectId(storeId), isArchived: false };
  const isValid = mongoose.Types.ObjectId.isValid(orderId);

  const buildQuery = (filter) =>
    PharmacyOrder.findOne(filter)
      .populate('customer',                   'name email phone avatar')
      .populate('delivery.internalPartner',   'name phone avatar')
      .populate('delivery.pickupPartner',     'name phone avatar')
      .populate('prescription.verifiedBy',    'name role')
      // FIX: populate items.medicine (schema field is 'medicine', NOT 'medicineId')
      .populate('items.medicine',             'name brandName genericName images hsnCode gstPercentage category')
      .populate('cancellation.cancelledBy',   'name role')
      .populate('cancellation.returnDecisionBy', 'name role')
      .populate('cancellation.pickupVerifiedBy', 'name role')
      .populate('adminNotes.addedBy',         'name role')
      .populate('store',                       'storeName contact address legal status') 
      .populate('customer',                    'name email phone avatar')
      .populate('delivery.internalPartner',    'name phone avatar')

  try {
    let order = null;
    if (isValid) {
      order = await buildQuery({ ...base, _id: new mongoose.Types.ObjectId(orderId) });
    }
    if (!order) {
      order = await buildQuery({ ...base, orderId });
    }
    return order;
  } catch (err) {
    logError('FIND_ORDER_POPULATED_ERROR', err, { orderId });
    return null;
  }
};

const parseDateFilter = (dateFilter, startDate, endDate) => {
  const now   = new Date();
  const start = new Date(now);
  const end   = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (dateFilter === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (dateFilter === 'yesterday') {
    start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);     end.setHours(23, 59, 59, 999);
  } else if (dateFilter === 'last7days') {
    start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
  } else if (dateFilter === 'last30days') {
    start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0);
  } else if (dateFilter === 'custom' && startDate && endDate) {
    return { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  return { $gte: start, $lte: end };
};

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page, 10)  || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || ITEMS_PER_PAGE), MAX_ITEMS_PER_PAGE);
  return { page, limit, skip: (page - 1) * limit };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § REDIS CACHE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

const cache = (ttlSeconds = 60, keyFn = null) => async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const cacheKey = keyFn ? keyFn(req) : `${req.method}:${req.originalUrl}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(JSON.parse(cached)); }
  } catch (err) { console.error('[Cache READ]', err.message); }

  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try { await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(body)); }
      catch (err) { console.error('[Cache WRITE]', err.message); }
    }
    res.setHeader('X-Cache', 'MISS');
    return originalJson(body);
  };
  next();
};

const invalidateStoreCache = async (storeId) => {
  try {
    const keys = await redisClient.keys(`pharmacy:${storeId}:*`);
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) { console.error('[Cache INVALIDATE store]', err.message); }
};

const invalidateHsnCache = async () => {
  try {
    const keys = await redisClient.keys('GET:*hsn*');
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) { console.error('[Cache INVALIDATE hsn]', err.message); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SYSTEM LOG HELPER
// ═══════════════════════════════════════════════════════════════════════════════

const sysLog = async (req, {
  level      = 'info',
  category   = 'system',
  message,
  details,
  relatedEntity,
  metadata,
  statusCode,
  durationMs,
}) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';

    await SystemLog.createLog({
      level,
      category,
      message,
      details,
      actor: {
        userId:    req.user?._id    || null,
        name:      req.user?.name   || 'system',
        email:     req.user?.email  || null,
        role:      req.user?.role   || 'system',
        ip,
        userAgent: req.headers['user-agent'] || null,
        platform:  'web',
      },
      relatedEntity: relatedEntity || {},
      request: {
        method:     req.method,
        path:       req.originalUrl,
        statusCode: statusCode || null,
        durationMs: durationMs || null,
      },
      metadata,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    });
  } catch (err) {
    console.error('[SystemLog.createLog failed]', err.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § NOTIFICATION + EMAIL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

const dispatchStatusNotification = async (order, newStatus, storeName = null) => {
  try {
    const customer = await User.findById(order.customer).select('email name').lean();
    if (!customer) return;
    await Notification.create({
      recipient:  order.customer,
      title:      'Order Status Updated',
      body:       `Your order #${order.orderId} is now: ${newStatus}`,
      type:       'Order_Update',
      priority:   'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id },
    });
    if (customer.email) {
      const html = buildStatusUpdateEmail({
        userName: customer.name, order, orderItems: order.items || [],
        billing: order.billing, storeName,
        actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}`,
        newStatus,
      });
      await sendEmail({
        email:   customer.email,
        subject: `[Likeson Healthcare] Order #${order.orderId} — ${newStatus.replace(/_/g, ' ')}`,
        html,
      });
    }
  } catch (err) { logError('STATUS_NOTIFICATION_ERROR', err, { orderId: order.orderId }); }
};

const dispatchSimpleNotification = async (userId, { title, body, type, emailSubject, emailBody, actionLink }) => {
  try {
    await Notification.create({
      recipient: userId, title, body, type, priority: 'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN' },
    });
    const user = await User.findById(userId).select('email name').lean();
    if (!user?.email) return;
    const html = transactionalTemplate({
      header: 'LIKESON HEALTHCARE', title: emailSubject || title,
      body: emailBody || body, buttonText: 'View Details',
      buttonLink: actionLink || 'https://likeson.in/dashboard', userName: user.name,
    });
    await sendEmail({ email: user.email, subject: `[Likeson Healthcare] ${emailSubject || title}`, html });
  } catch (err) { logError('SIMPLE_NOTIFICATION_ERROR', err, { userId }); }
};

const dispatchLowStockAlert = async (medicine, storeId, stockQuantity, pharmacyUserId) => {
  try {
    const [pharmacyUser, store] = await Promise.all([
      User.findById(pharmacyUserId).select('email name').lean(),
      PharmacyStore.findById(storeId).select('storeName').lean(),
    ]);
    if (!pharmacyUser) return;

    await Notification.create({
      recipient: pharmacyUserId,
      title:     '🔴 Low Stock Alert',
      body:      `${medicine.brandName || medicine.name} is critically low (${stockQuantity} units) at ${store?.storeName || 'your store'}. Please restock immediately.`,
      type:      'Medicine_Ready',
      priority:  'High',
      metadata:  { medicineId: medicine._id, storeId, stockQuantity },
    });

    if (pharmacyUser.email) {
      const html = buildLowStockAlertEmail({
        userName:  pharmacyUser.name,
        storeName: store?.storeName || 'Your Store',
        items: [{
          name:          medicine.brandName || medicine.name,
          brandName:     medicine.brandName,
          category:      medicine.category,
          stockQuantity,
          threshold:     LOW_STOCK_THRESHOLD,
        }],
        threshold: LOW_STOCK_THRESHOLD,
      });
      sendEmail({
        email:   pharmacyUser.email,
        subject: `[Likeson Healthcare] 🔴 Low Stock: ${medicine.brandName || medicine.name} — Restock Required`,
        html,
      }).catch((err) => logError('LOW_STOCK_EMAIL_ERROR', err));
    }
  } catch (err) { logError('LOW_STOCK_ALERT_ERROR', err, { medicineId: medicine._id, storeId }); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HSN PARSE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const normalizeHsnRow = (raw) => {
  const lower = {};
  for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase().trim()] = String(v ?? '').trim();
  const get = (aliases) => { for (const a of aliases) { if (lower[a] !== undefined && lower[a] !== '') return lower[a]; } return ''; };
  const gstRaw = get(HSN_COLUMN_ALIASES.gstPercentage);
  const gstNum = parseFloat(gstRaw.replace('%', '').trim());
  return {
    hsnCode:        get(HSN_COLUMN_ALIASES.hsnCode).toUpperCase().replace(/\s/g, ''),
    description:    get(HSN_COLUMN_ALIASES.description),
    chapterHeading: get(HSN_COLUMN_ALIASES.chapterHeading),
    gstPercentage:  isNaN(gstNum) ? null : gstNum,
  };
};

const parseExcelBuffer = (buffer) => {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sn = wb.SheetNames[0];
  if (!sn) throw new Error('Excel file contains no sheets.');
  return xlsx.utils.sheet_to_json(wb.Sheets[sn], { defval: '', raw: true, blankrows: false });
};

const parsePdfBuffer = async (buffer) => {
  const data  = await pdfParse(buffer);
  const lines = data.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows  = [];
  for (const line of lines) {
    const match = line.match(/^(\d{4,8})\s{1,10}(.+?)\s{1,10}(Chapter\s+\d+[^0-9]*)?\s{0,10}(\d{1,2})\s*%?$/i);
    if (match) rows.push({ 'HSN Code': match[1].trim(), Description: match[2].trim(), 'Chapter Heading': match[3]?.trim() || '', 'GST %': match[4].trim() });
  }
  if (!rows.length) throw new Error('Could not extract HSN rows from the PDF. Use the Excel template.');
  return rows;
};

const uploadToImageKit = async (buffer, fileName, folder = IMAGEKIT.folder) => {
  const formData = new FormData();
  formData.append('file',             buffer, { filename: fileName });
  formData.append('fileName',         fileName);
  formData.append('folder',           folder);
  formData.append('useUniqueFileName', 'true');

  const auth = Buffer.from(`${IMAGEKIT.privateKey}:`).toString('base64');

  const response = await axios.post(IMAGEKIT.uploadUrl, formData, {
    headers: {
      ...formData.getHeaders(),
      Authorization: `Basic ${auth}`,
    },
    maxBodyLength: MAX_FILE_BYTES + 1024,
    timeout:       30_000,
  });

  return response.data;
};

const upsertHsnRows = async (rows, userId, source = 'manual') => {
  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];
  for (const raw of rows) {
    const row = normalizeHsnRow(raw);
    if (!row.hsnCode) { errors.push(`Skipped — missing HSN code: ${JSON.stringify(raw)}`); skipped++; continue; }
    if (!/^\d{4,8}$/.test(row.hsnCode)) { errors.push(`Skipped — invalid HSN format: ${row.hsnCode}`); skipped++; continue; }
    if (row.gstPercentage === null || !VALID_GST_SLABS.includes(row.gstPercentage)) {
      errors.push(`Skipped — invalid GST slab for ${row.hsnCode}: ${row.gstPercentage}. Allowed: ${VALID_GST_SLABS.join(', ')}`);
      skipped++; continue;
    }
    if (!row.description) { errors.push(`Skipped — missing description for: ${row.hsnCode}`); skipped++; continue; }
    try {
      const ex = await HsnCode.findOne({ hsnCode: row.hsnCode });
      if (ex) {
        ex.description    = row.description    || ex.description;
        ex.chapterHeading = row.chapterHeading || ex.chapterHeading;
        ex.gstPercentage  = row.gstPercentage;
        ex.uploadedBy     = userId;
        ex.uploadSource   = source;
        ex.isActive       = true;
        await ex.save();
        updated++;
      } else {
        await HsnCode.create({ hsnCode: row.hsnCode, description: row.description, chapterHeading: row.chapterHeading, gstPercentage: row.gstPercentage, uploadedBy: userId, uploadSource: source, isActive: true });
        inserted++;
      }
    } catch (err) {
      errors.push(err.code === 11000 ? `Duplicate skip: ${row.hsnCode}` : `Error on ${row.hsnCode}: ${err.message}`);
    }
  }
  return { inserted, updated, skipped, errors };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION C — HSN CODE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/hsn', protect, authorize('pharmacy', 'admin', 'superadmin'),
  cache(120),
  asyncHandler(async (req, res) => {
    const { search, gst, isActive = 'true', page = 1, limit = 20, sort = 'hsnCode' } = req.query;
    const query = {};
    if (isActive !== 'all') query.isActive = isActive !== 'false';
    if (gst) { const g = parseFloat(gst); if (VALID_GST_SLABS.includes(g)) query.gstPercentage = g; }
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ hsnCode: { $regex: esc, $options: 'i' } }, { description: { $regex: esc, $options: 'i' } }];
    }
    const sortMap = { hsnCode: { hsnCode: 1 }, hsnCode_desc: { hsnCode: -1 }, gst_asc: { gstPercentage: 1 }, newest: { createdAt: -1 } };
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const [codes, total] = await Promise.all([
      HsnCode.find(query).sort(sortMap[sort] || { hsnCode: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      HsnCode.countDocuments(query),
    ]);
    res.status(200).json({ success: true, total, metadata: { currentPage: pageNum, totalPages: Math.ceil(total / limitNum), pageSize: limitNum }, data: codes });
  })
);

router.get('/hsn/stats', protect, authorize('superadmin', 'admin'),
  cache(300, () => 'GET:pharmacy:hsn:stats'),
  asyncHandler(async (req, res) => {
    const stats = await HsnCode.aggregate([{ $facet: {
      gstDistribution:  [{ $group: { _id: '$gstPercentage', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      sourceBreakdown:  [{ $group: { _id: '$uploadSource', count: { $sum: 1 } } }],
      activeVsInactive: [{ $group: { _id: '$isActive', count: { $sum: 1 } } }],
      totals:           [{ $group: { _id: null, total: { $sum: 1 } } }],
    }}]);
    res.status(200).json({ success: true, data: stats[0], generatedAt: new Date() });
  })
);

router.post('/hsn/bulk-delete', protect, authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const { codes } = req.body;
    if (!Array.isArray(codes) || !codes.length) return res.status(400).json({ success: false, message: 'Provide a non-empty array of HSN codes.' });
    const normalized = codes.map((c) => String(c).toUpperCase().replace(/\s/g, '').trim());
    const result = await HsnCode.updateMany({ hsnCode: { $in: normalized }, isActive: true }, { $set: { isActive: false } });
    await invalidateHsnCache();
    await sysLog(req, { level: 'warning', category: 'system', message: `Bulk deactivated ${result.modifiedCount} HSN codes`, metadata: { codes: normalized } });
    res.status(200).json({ success: true, message: `${result.modifiedCount} HSN code(s) deactivated.`, matched: result.matchedCount, deactivated: result.modifiedCount });
  })
);

router.post('/hsn/upload', protect, authorize('superadmin', 'admin'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded. Send multipart/form-data with field "file".' });
    const { buffer, originalname, mimetype, size } = req.file;
    const ext = (originalname.split('.').pop() || '').toLowerCase();

    let ikResult;
    try {
      const safeName = `${originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}_${Date.now()}.${ext}`;
      ikResult = await uploadToImageKit(buffer, safeName);
    } catch (err) {
      logError('HSN_IK_UPLOAD', err);
      return res.status(502).json({ success: false, message: 'ImageKit upload failed. Try again.', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }

    let rows, source;
    const isExcel = ['xlsx','xls','csv'].includes(ext) || mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype === 'text/csv';
    const isPdf   = ext === 'pdf' || mimetype === 'application/pdf';
    try {
      if (isExcel)      { rows = parseExcelBuffer(buffer); source = 'excel'; }
      else if (isPdf)   { rows = await parsePdfBuffer(buffer); source = 'pdf'; }
      else { try { rows = parseExcelBuffer(buffer); source = 'excel'; } catch { return res.status(415).json({ success: false, message: `Unsupported type: ${mimetype || ext}`, imagekitUrl: ikResult.url }); } }
    } catch (err) { return res.status(422).json({ success: false, message: `Parse failed: ${err.message}`, imagekitUrl: ikResult.url }); }
    if (!rows?.length) return res.status(422).json({ success: false, message: 'No data rows found.', imagekitUrl: ikResult.url });

    const result = await upsertHsnRows(rows, req.user._id, source);
    await invalidateHsnCache();
    await sysLog(req, {
      level: 'success', category: 'system',
      message: `HSN bulk upload: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`,
      metadata: { source, file: originalname, size, imagekitUrl: ikResult.url, ...result },
    });
    const hasErrors = result.errors.length > 0;
    res.status(hasErrors ? 207 : 200).json({
      success: true,
      message: hasErrors ? 'Upload completed with some row errors.' : 'Upload successful.',
      upload:  { imagekitUrl: ikResult.url, imagekitFileId: ikResult.fileId, originalName: originalname, source },
      result:  { ...result, errors: result.errors.slice(0, 50) },
    });
  })
);

router.get('/hsn/:code', protect, authorize('pharmacy', 'admin', 'superadmin'),
  cache(300, (req) => `hsn:code:${req.params.code.toUpperCase().trim()}`),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ success: false, message: 'Invalid HSN code format. Must be 4–8 digits.' });
    const hsn = await HsnCode.findOne({ hsnCode: code, isActive: true }).lean();
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found or inactive.` });
    res.status(200).json({ success: true, data: { _id: hsn._id, hsnCode: hsn.hsnCode, description: hsn.description, chapterHeading: hsn.chapterHeading, gstPercentage: hsn.gstPercentage, cgstPercentage: hsn.cgstPercentage, sgstPercentage: hsn.sgstPercentage, igstPercentage: hsn.igstPercentage } });
  })
);

router.post('/hsn', protect, authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { hsnCode, description, chapterHeading, gstPercentage } = req.body;
    if (!hsnCode || !description || gstPercentage === undefined) return res.status(400).json({ success: false, message: 'hsnCode, description, and gstPercentage are required.' });
    const code   = String(hsnCode).toUpperCase().replace(/\s/g, '').trim();
    if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ success: false, message: 'hsnCode must be 4–8 digits.' });
    const gstNum = parseFloat(gstPercentage);
    if (!VALID_GST_SLABS.includes(gstNum)) return res.status(400).json({ success: false, message: `Invalid gstPercentage. Allowed: ${VALID_GST_SLABS.join(', ')}` });
    const existing = await HsnCode.findOne({ hsnCode: code });
    if (existing) return res.status(409).json({ success: false, message: `HSN code '${code}' already exists.`, existingId: existing._id });
    const hsn = await HsnCode.create({ hsnCode: code, description: String(description).trim(), chapterHeading: chapterHeading?.trim(), gstPercentage: gstNum, uploadedBy: req.user._id, uploadSource: 'manual' });
    await invalidateHsnCache();
    await sysLog(req, { level: 'success', category: 'system', message: `HSN code ${code} created`, metadata: { gstPercentage: gstNum } });
    res.status(201).json({ success: true, data: hsn });
  })
);

router.patch('/hsn/:code', protect, authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    const hsn  = await HsnCode.findOne({ hsnCode: code });
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found.` });
    const { description, chapterHeading, gstPercentage, isActive } = req.body;
    if (description    !== undefined) hsn.description    = String(description).trim();
    if (chapterHeading !== undefined) hsn.chapterHeading = String(chapterHeading).trim();
    if (isActive       !== undefined) hsn.isActive       = Boolean(isActive);
    if (gstPercentage  !== undefined) {
      const g = parseFloat(gstPercentage);
      if (!VALID_GST_SLABS.includes(g)) return res.status(400).json({ success: false, message: `Invalid gstPercentage. Allowed: ${VALID_GST_SLABS.join(', ')}` });
      hsn.gstPercentage = g;
    }
    hsn.uploadedBy = req.user._id; hsn.uploadSource = 'manual';
    await hsn.save();
    await invalidateHsnCache();
    await sysLog(req, { level: 'info', category: 'system', message: `HSN code ${code} updated` });
    res.status(200).json({ success: true, data: hsn });
  })
);

router.delete('/hsn/:code', protect, authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    const hsn  = await HsnCode.findOne({ hsnCode: code });
    if (!hsn) return res.status(404).json({ success: false, message: `HSN code '${code}' not found.` });
    if (!hsn.isActive) return res.status(409).json({ success: false, message: `HSN code '${code}' is already inactive.` });
    hsn.isActive = false;
    await hsn.save();
    await invalidateHsnCache();
    await sysLog(req, { level: 'warning', category: 'system', message: `HSN code ${code} deactivated` });
    res.status(200).json({ success: true, message: `HSN code '${code}' has been deactivated.` });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION A — ORDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * [01] GET /orders
 */
router.get('/orders', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(30, (req) => `pharmacy:${req.pharmacy?.store?._id}:orders:${JSON.stringify(req.query)}`),
  asyncHandler(async (req, res) => {
    const { status, dateFilter = 'today', startDate, endDate, paymentStatus, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const filter = { store: req.pharmacy.store._id, isArchived: false };
    if (status)        filter['delivery.status'] = status;
    if (paymentStatus) filter['payment.status']  = paymentStatus;
    filter.createdAt = parseDateFilter(dateFilter, startDate, endDate);
    const allowedSort = ['createdAt', 'updatedAt', 'billing.totalPayable'];
    const sortField   = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    const [orders, totalCount] = await Promise.all([
      PharmacyOrder.find(filter)
      .populate('store', 'storeName contact address status')
        .populate('customer', 'name email phone')
 
 .populate('items.medicine', 'name brandName genericName images category')
        .sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      PharmacyOrder.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalItems: totalCount, itemsPerPage: limit },
      },
    });
  })
);

/**
 * [02] GET /orders/:orderId
 * FIX: Uses findOrderPopulated() which populates items.medicine and all refs,
 *      then serialises with toObject({ virtuals: true }) so all 4 virtuals
 *      (isReturnPending, isRefundPending, canBeRefunded, canRequestReturn) are present.
 */
router.get('/orders/:orderId', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const order = await findOrderPopulated(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: `Order ${req.params.orderId} not found.` });
    // toObject({ virtuals: true }) ensures virtual fields are included in the JSON
    res.status(200).json({ success: true, data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [03] POST /orders/:orderId/verify-prescription
 */
router.post('/orders/:orderId/verify-prescription', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { isVerified, verificationNotes = '', rejectionReason = '' } = req.body;
    if (typeof isVerified !== 'boolean') return res.status(400).json({ success: false, message: 'isVerified must be boolean.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    order.prescription.isVerified          = isVerified;
    order.prescription.verificationStatus  = isVerified ? 'Approved' : 'Rejected';
    order.prescription.verificationNotes   = verificationNotes;
    order.prescription.rejectionReason     = rejectionReason;
    order.prescription.verifiedBy          = req.user._id;
    order.prescription.verifiedAt          = new Date();
    await order.save();
    await sysLog(req, {
      level: isVerified ? 'success' : 'warning', category: 'user',
      message: `Prescription ${isVerified ? 'approved' : 'rejected'} for order ${order.orderId}`,
      relatedEntity: { model: 'PharmacyOrder', entityId: order._id, label: order.orderId },
    });
    dispatchSimpleNotification(order.customer, {
      title:        isVerified ? 'Prescription Approved' : 'Prescription Rejected',
      body:         isVerified ? `Your prescription for #${order.orderId} has been approved.` : `Prescription for #${order.orderId} was rejected. ${rejectionReason || ''}`,
      type:         'Prescription_Update',
      emailSubject: isVerified ? 'Prescription Approved' : 'Prescription Rejected',
      emailBody:    isVerified ? `Your prescription for #${order.orderId} has been verified.` : `Your prescription for #${order.orderId} was rejected. Please re-upload.`,
      actionLink:   `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}`,
    });
    res.status(200).json({ success: true, message: isVerified ? 'Prescription approved.' : 'Prescription rejected.', data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [04] POST /orders/:orderId/confirm
 */
router.post('/orders/:orderId/confirm', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { deliveryType, internalPartner, externalPartner } = req.body;
    if (!['Internal', 'Third-Party'].includes(deliveryType)) return res.status(400).json({ success: false, message: 'Invalid deliveryType.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.delivery.status !== 'Placed') return res.status(400).json({ success: false, message: 'Order must be in Placed status.' });
    order.delivery.status       = 'Confirmed';
    order.delivery.deliveryType = deliveryType;
    if (deliveryType === 'Internal'     && internalPartner) order.delivery.internalPartner = internalPartner;
    if (deliveryType === 'Third-Party'  && externalPartner) order.delivery.externalPartner = externalPartner;
    await order.save();
    logAudit('ORDER_CONFIRMED', { orderId: order.orderId, staffId: req.user._id });
    await sysLog(req, { level: 'success', category: 'user', message: `Order ${order.orderId} confirmed`, relatedEntity: { model: 'PharmacyOrder', entityId: order._id, label: order.orderId } });
    const storeDoc = await PharmacyStore.findById(req.pharmacy.store._id).select('storeName').lean();
    dispatchStatusNotification(order.toObject({ virtuals: true }), 'Confirmed', storeDoc?.storeName);
    res.status(200).json({ success: true, message: 'Order confirmed.', data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [05] PATCH /orders/:orderId/status
 * FIX: Removed `order.delivery.notes = note` — 'notes' does not exist in the
 *      delivery sub-schema. Notes are now pushed into statusHistory instead,
 *      which is the correct field for per-transition audit notes.
 */
router.patch('/orders/:orderId/status', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { status, note, estimatedArrival } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const validTransitions = {
      Placed:             ['Confirmed', 'Cancelled'],
      Confirmed:          ['Processing', 'Cancelled'],
      Processing:         ['Out-for-Delivery', 'Cancelled'],
      'Out-for-Delivery': ['Delivered', 'Cancelled'],
      Delivered:          ['Return_Requested'],
      Return_Requested:   ['Return_Accepted', 'Return_Rejected'],
      Return_Accepted:    ['Pickup_Assigned'],
      Pickup_Assigned:    ['Pickup_Done'],
      Pickup_Done:        ['Returned'],
    };

    const currentStatus = order.delivery.status;
    if (!validTransitions[currentStatus]?.includes(status))
      return res.status(400).json({ success: false, message: `Cannot transition from ${currentStatus} to ${status}.` });

    order.delivery.status = status;

    // FIX: 'delivery.notes' does not exist in schema — attach note inside statusHistory entry.
    // The pre-save hook appends to statusHistory on status change; we store the note there
    // by setting $locals so the hook can read it, or we push manually here before save.
    if (!Array.isArray(order.delivery.statusHistory)) order.delivery.statusHistory = [];
    order.delivery.statusHistory.push({
      status,
      changedBy: req.user._id,
      note:      note || undefined,
      timestamp: new Date(),
    });

    if (estimatedArrival && status === 'Out-for-Delivery') {
      order.delivery.estimatedArrival = new Date(estimatedArrival);
    }
    if (status === 'Delivered') {
      order.delivery.deliveredAt = new Date();
    }
    if (status === 'Out-for-Delivery') {
      const otpCode = generateOtp();
      order.deliveryOtp = { code: otpCode, expiresAt: new Date(Date.now() + 30 * 60 * 1000), verified: false, sentAt: new Date() };
      const customer = await User.findById(order.customer).select('email name').lean();
      if (customer?.email) {
        const otpHtml = buildDeliveryOtpEmail({ userName: customer.name, order: order.toObject(), otpCode });
        sendEmail({ email: customer.email, subject: `[Likeson Healthcare] Delivery OTP for Order #${order.orderId}`, html: otpHtml })
          .catch((err) => logError('OTP_EMAIL', err));
      }
    }

    await order.save();
    logAudit('STATUS_UPDATED', { orderId: order.orderId, from: currentStatus, to: status, staffId: req.user._id });
    await sysLog(req, {
      level: 'info', category: 'user',
      message: `Order ${order.orderId} status: ${currentStatus} → ${status}`,
      relatedEntity: { model: 'PharmacyOrder', entityId: order._id, label: order.orderId },
      metadata: { from: currentStatus, to: status, note },
    });
    const storeDoc = await PharmacyStore.findById(req.pharmacy.store._id).select('storeName').lean();
    dispatchStatusNotification(order.toObject({ virtuals: true }), status, storeDoc?.storeName);
    res.status(200).json({ success: true, message: `Status updated to ${status}.`, data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [06] POST /orders/:orderId/return-accept
 */
router.post('/orders/:orderId/return-accept', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { pickupPartner, pickupEstimatedAt } = req.body;
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.delivery.status !== 'Return_Requested') return res.status(400).json({ success: false, message: 'Order must be in Return_Requested status.' });
    order.delivery.status               = 'Return_Accepted';
    order.delivery.pickupPartner        = pickupPartner;
    if (pickupEstimatedAt) order.delivery.pickupEstimatedAt = new Date(pickupEstimatedAt);
    order.cancellation.returnDecision   = 'Accepted';
    order.cancellation.returnDecisionBy = req.user._id;
    order.cancellation.returnDecisionAt = new Date();
    await order.save();
    await sysLog(req, { level: 'info', category: 'user', message: `Return accepted for ${order.orderId}`, relatedEntity: { model: 'PharmacyOrder', entityId: order._id } });
    const storeDoc = await PharmacyStore.findById(req.pharmacy.store._id).select('storeName').lean();
    dispatchStatusNotification(order.toObject({ virtuals: true }), 'Return_Accepted', storeDoc?.storeName);
    res.status(200).json({ success: true, message: 'Return accepted.', data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [07] POST /orders/:orderId/process-refund
 */
router.post('/orders/:orderId/process-refund', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { amount, reason } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.payment.razorpayPaymentId) return res.status(400).json({ success: false, message: 'No Razorpay payment found.' });
    try {
      const refund = await razorpay.payments.refund(order.payment.razorpayPaymentId, { amount: Math.round(amount * 100), notes: { orderId: order.orderId, reason } });
      order.cancellation.refundId     = refund.id;
      order.cancellation.refundStatus = 'Processed';
      order.cancellation.refundedAt   = new Date();
      order.payment.status            = 'Refunded';
      await order.save();
      logAudit('REFUND_PROCESSED', { orderId: order.orderId, amount, razorpayRefundId: refund.id });
      await sysLog(req, { level: 'success', category: 'payment', message: `Refund ₹${amount} processed for ${order.orderId}`, relatedEntity: { model: 'PharmacyOrder', entityId: order._id }, metadata: { amount, razorpayRefundId: refund.id } });
      const customer = await User.findById(order.customer).select('email name').lean();
      if (customer?.email) {
        const refundHtml = buildRefundEmail({ userName: customer.name, order: order.toObject(), refundAmount: amount, refundMethod: order.cancellation.refundMethod || 'Original_Source', bankDetails: order.cancellation.bankDetails, actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}` });
        sendEmail({ email: customer.email, subject: `[Likeson Healthcare] Refund Initiated — Order #${order.orderId}`, html: refundHtml }).catch((err) => logError('REFUND_EMAIL', err));
        Notification.create({ recipient: order.customer, title: 'Refund Initiated', body: `Refund of ₹${amount} initiated for order #${order.orderId}.`, type: 'Refund_Update', priority: 'High', actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id } });
      }
      res.status(200).json({ success: true, message: 'Refund processed.', data: { order: order.toObject({ virtuals: true }), refundId: refund.id } });
    } catch (error) {
      logError('REFUND_ERROR', error, { orderId: order.orderId });
      await sysLog(req, { level: 'error', category: 'payment', message: `Refund failed for ${order.orderId}: ${error.message}` });
      return res.status(400).json({ success: false, message: `Refund failed: ${error.message}` });
    }
  })
);

/**
 * [08] POST /orders/:orderId/add-admin-note
 */
router.post('/orders/:orderId/add-admin-note', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, message: 'Note is required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!Array.isArray(order.adminNotes)) order.adminNotes = [];
    order.adminNotes.push({ text: note.trim(), addedBy: req.user._id, addedAt: new Date() });
    await order.save();
    res.status(200).json({ success: true, message: 'Note added.', data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [09] POST /orders/:orderId/assign-delivery-partner
 */
router.post('/orders/:orderId/assign-delivery-partner', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { deliveryPartnerId } = req.body;
    if (!deliveryPartnerId) return res.status(400).json({ success: false, message: 'deliveryPartnerId is required.' });
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    order.delivery.internalPartner = deliveryPartnerId;
    await order.save();
    await sysLog(req, { level: 'info', category: 'user', message: `Delivery partner ${deliveryPartnerId} assigned to ${order.orderId}` });
    dispatchSimpleNotification(order.customer, { title: 'Delivery Partner Assigned', body: `A delivery partner has been assigned for order #${order.orderId}.`, type: 'Order_Update', emailSubject: 'Delivery Partner Assigned', emailBody: `A delivery partner has been assigned for your order #${order.orderId}.`, actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}` });
    res.status(200).json({ success: true, message: 'Partner assigned.', data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [10] GET /orders/:orderId/export
 * FIX: Uses findOrderPopulated + toObject({ virtuals: true }) so all fields
 *      including virtual flags are present in the export payload.
 */
router.get('/orders/:orderId/export', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const order = await findOrderPopulated(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.status(200).json({ success: true, data: { order: order.toObject({ virtuals: true }) } });
  })
);

/**
 * [11] POST /orders/:orderId/pickup-verify
 * FIX: selectedRefundMethod 'Online' is not in refundMethod enum.
 *      Map 'Online' → 'Original_Source' when writing to refundMethod.
 */
router.post('/orders/:orderId/pickup-verify', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { pickupConditionGood, pickupConditionNotes = '' } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await PharmacyOrder.findOne({
        store: req.pharmacy.store._id, isArchived: false,
        $or: [
          { orderId: req.params.orderId },
          ...(mongoose.Types.ObjectId.isValid(req.params.orderId)
            ? [{ _id: new mongoose.Types.ObjectId(req.params.orderId) }]
            : []),
        ],
      }).session(session);

      if (!order) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Order not found.' }); }
      if (order.delivery.status !== 'Pickup_Done') { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Order must be in Pickup_Done status.' }); }

      order.delivery.status                   = 'Returned';
      order.cancellation.pickupConditionGood  = pickupConditionGood;
      order.cancellation.pickupConditionNotes = pickupConditionNotes;
      order.cancellation.pickupVerifiedBy     = req.user._id;
      order.cancellation.pickupVerifiedAt     = new Date();

      if (pickupConditionGood) {
        order.cancellation.refundStatus = 'Requested';
        order.cancellation.refundAmount = order.billing.totalPayable;

        const selectedMethod = order.cancellation.selectedRefundMethod || 'Original_Source';

        // FIX: selectedRefundMethod enum includes 'Online' but refundMethod enum does NOT.
        // Map 'Online' → 'Original_Source' (Razorpay reversal) to keep enum valid.
        const refundMethodMap = {
          Wallet:       'Wallet',
          Online:       'Original_Source',   // ← FIX
          Original_Source: 'Original_Source',
          Bank_Transfer:   'Bank_Transfer',
          Custom_Bank:     'Bank_Transfer',   // custom bank details provided separately
        };
        order.cancellation.refundMethod = refundMethodMap[selectedMethod] || 'Original_Source';

        if (selectedMethod === 'Wallet') {
          const wallet = await Wallet.findOne({ user: order.customer }).session(session);
          if (wallet) {
            const balanceBefore = wallet.balance;
            wallet.balance = parseFloat((wallet.balance + order.billing.totalPayable).toFixed(2));
            wallet.transactions.push({
              transactionId: `TXN-${Date.now()}`,
              type: 'Credit',
              amount: order.billing.totalPayable,
              purpose: 'Return_Refund',
              referenceId: order._id,
              onModel: 'PharmacyOrder',
              status: 'Success',
              balanceBefore,
              balanceAfter: wallet.balance,
              description: `Refund for returned order #${order.orderId}`,
            });
            await wallet.save({ session });
          }
          order.cancellation.refundStatus = 'Processed';
          order.cancellation.refundedAt   = new Date();
        }
      }

      await order.save({ session });
      await session.commitTransaction();

      logAudit('PICKUP_VERIFIED', { orderId: order.orderId, conditionGood: pickupConditionGood });
      await sysLog(req, {
        level: pickupConditionGood ? 'success' : 'warning', category: 'user',
        message: `Pickup verified for ${order.orderId} — condition: ${pickupConditionGood ? 'good' : 'bad'}`,
        relatedEntity: { model: 'PharmacyOrder', entityId: order._id },
      });

      const customer = await User.findById(order.customer).select('email name').lean();
      if (pickupConditionGood && customer?.email) {
        const refundHtml = buildRefundEmail({ userName: customer.name, order: order.toObject(), refundAmount: order.billing.totalPayable, refundMethod: order.cancellation.refundMethod, bankDetails: order.cancellation.bankDetails, actionLink: `${process.env.FRONTEND_URL}/pharmacy/orders/${order._id}` });
        sendEmail({ email: customer.email, subject: `[Likeson Healthcare] Refund Initiated — Order #${order.orderId}`, html: refundHtml }).catch((err) => logError('REFUND_EMAIL', err));
      }
      Notification.create({ recipient: order.customer, title: pickupConditionGood ? 'Refund Initiated' : 'Return Rejected', body: pickupConditionGood ? `Refund of ₹${order.billing.totalPayable} initiated for #${order.orderId}.` : `Return for #${order.orderId} was rejected. Items not in return condition.`, type: 'Return_Verification', priority: 'High', actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id } });
      res.status(200).json({ success: true, message: pickupConditionGood ? 'Return verified. Refund initiated.' : 'Return rejected.', data: { order: order.toObject({ virtuals: true }) } });
    } catch (err) {
      await session.abortTransaction();
      logError('PICKUP_VERIFY_ERROR', err, { orderId: req.params.orderId });
      throw err;
    } finally { session.endSession(); }
  })
);

/**
 * [12] GET /orders/:orderId/invoice
 */
router.get(
  '/orders/:orderId/invoice',
  protect,
  authorize('pharmacy'),
  attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
 
    await order.populate('store', 'storeName address');
 
    const customer     = await User.findById(order.customer).select('name email phone').lean();
    const storeDoc     = order.store;
    const storeAddress = storeDoc?.address
      ? `${storeDoc.address.line1 || ''}, ${storeDoc.address.city || 'Vijayawada'}, ${storeDoc.address.state || 'Andhra Pradesh'}`
      : 'Vijayawada, Andhra Pradesh';
 
    const html = buildInvoiceHtml({
      order:        order.toObject({ virtuals: true }),
      user:         customer,
      storeName:    storeDoc?.storeName || 'Likeson Pharmacy',
      storeAddress,
    });
 
    res.status(200).send(html);
  }),
);
 
/**
 * [13] GET /orders/:orderId/label
 *
 * Populate path: items.medicine → hsnCode (HsnCode collection)
 * This gives each item an hsnCode object with { hsnCode: string, gstPercentage: number }.
 * The generateDeliveryLabel util handles both string and object forms gracefully.
 *
 * Response: Content-Disposition: attachment triggers immediate browser download.
 */
router.get(
  '/orders/:orderId/label',
  protect,
  authorize('pharmacy'),
  attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const order = await findOrderByIdOrString(req.params.orderId, req.pharmacy.store._id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
 
    // Populate each item's medicine, then the medicine's hsnCode reference
    // so item.hsnCode becomes a full HsnCode document { hsnCode, gstPercentage, ... }
    await order.populate({
      path:     'items.medicine',
      populate: {
        path:   'hsnCode',
        model:  'HsnCode',
        select: 'hsnCode description gstPercentage cgstPercentage sgstPercentage',
      },
    });
 
    // Merge populated hsnCode into each order item so the label util sees it
    // Order items already carry hsnCode as a plain string from the snapshot.
    // Override with the populated object when available for richer data.
    const orderObj = order.toObject({ virtuals: true });
    orderObj.items = orderObj.items.map((item) => ({
      ...item,
      // Prefer the populated HsnCode doc; fall back to the stored string snapshot
      hsnCode: item.medicine?.hsnCode ?? item.hsnCode,
      // Prefer populated GST percentage
      gstPercentage: item.medicine?.hsnCode?.gstPercentage ?? item.gstPercentage,
    }));
 
    const [storeDoc, customer] = await Promise.all([
      PharmacyStore.findById(req.pharmacy.store._id).lean(),
      User.findById(order.customer).select('name email phone').lean(),
    ]);
 
    const { html, labelId } = await generateDeliveryLabel({
      order:    orderObj,
      store:    storeDoc,
      customer,
    });
 
    logAudit('LABEL_GENERATED', { orderId: order.orderId, labelId, staffId: req.user._id });
 
    await sysLog(req, {
      level:    'info',
      category: 'system',
      message:  `Delivery label ${labelId} generated for order ${order.orderId}`,
      relatedEntity: {
        model:    'PharmacyOrder',
        entityId: order._id,
        label:    order.orderId,
      },
      metadata: { labelId },
    });
 
    // ── Auto-download response ──────────────────────────────────────────────
    // Content-Disposition: attachment tells the browser to download the file
    // rather than render it. filename is shown in the save-as dialog.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="label-${order.orderId}.html"`,
    );
    res.status(200).send(html);
  }),
);

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION B — INVENTORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * [14] GET /medicines
 * FIX: lowStock filter was applied against 'storeInventory.stockQuantity' directly,
 *      but storeInventory is an ARRAY after $addFields — you must use $elemMatch.
 *      Same fix applied to expiringSoon filter.
 */
router.get('/medicines', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:medicines:${JSON.stringify(req.query)}`),
  asyncHandler(async (req, res) => {
    const { search, category, lowStock, expiringSoon } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const storeId = req.pharmacy.store._id;

    const filter = { 'inventory.storeId': storeId };
    if (search) {
      filter.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { brandName:   { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) filter.category = category;

    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          storeInventory: {
            $filter: { input: '$inventory', as: 'inv', cond: { $eq: ['$$inv.storeId', storeId] } },
          },
        },
      },
      { $match: { 'storeInventory.0': { $exists: true } } },
    ];

    // FIX: storeInventory is an array — use $elemMatch-style $filter inside $match
    if (lowStock === 'true') {
      pipeline.push({
        $match: {
          storeInventory: {
            $elemMatch: { stockQuantity: { $lte: LOW_STOCK_THRESHOLD, $gt: 0 } },
          },
        },
      });
    }
    if (expiringSoon === 'true') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + EXPIRY_ALERT_DAYS);
      pipeline.push({
        $match: {
          storeInventory: {
            $elemMatch: { expiryDate: { $lte: cutoff, $gte: new Date() } },
          },
        },
      });
    }

    const countPipeline  = [...pipeline, { $count: 'total' }];
    const resultPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limit },
      { $project: { inventory: 0 } },
    ];

    const [medicines, countResult] = await Promise.all([
      Medicine.aggregate(resultPipeline),
      Medicine.aggregate(countPipeline),
    ]);

    await Medicine.populate(medicines, {
      path:   'hsnCode',
      select: 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage',
    });

    res.status(200).json({
      success: true,
      data: {
        medicines,
        pagination: {
          currentPage: page,
          totalPages:  Math.ceil((countResult[0]?.total || 0) / limit),
          totalItems:  countResult[0]?.total || 0,
        },
      },
    });
  })
);

/**
 * [15] POST /medicines/:medicineId/add-stock
 */
router.post('/medicines/:medicineId/add-stock', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { stockQuantity, batchNumber, expiryDate, pricePerUnit } = req.body;
    if (!stockQuantity || stockQuantity <= 0) return res.status(400).json({ success: false, message: 'stockQuantity must be > 0.' });
    if (!batchNumber)  return res.status(400).json({ success: false, message: 'batchNumber is required.' });
    if (!expiryDate)   return res.status(400).json({ success: false, message: 'expiryDate is required.' });

    const medicine = await Medicine.findById(req.params.medicineId);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    const storeId     = req.pharmacy.store._id;
    const existingIdx = medicine.inventory.findIndex(
      (inv) => inv.storeId.equals(storeId) && inv.batchNumber === batchNumber
    );

    if (existingIdx >= 0) {
      medicine.inventory[existingIdx].stockQuantity += Number(stockQuantity);
      medicine.inventory[existingIdx].expiryDate    = new Date(expiryDate);
      medicine.inventory[existingIdx].pricePerUnit  = pricePerUnit ?? medicine.inventory[existingIdx].pricePerUnit;
      medicine.inventory[existingIdx].isLowStock    = medicine.inventory[existingIdx].stockQuantity <= LOW_STOCK_THRESHOLD;
    } else {
      medicine.inventory.push({
        storeId,
        addedBy:       req.user._id,
        stockQuantity: Number(stockQuantity),
        batchNumber,
        expiryDate:    new Date(expiryDate),
        pricePerUnit:  pricePerUnit ?? medicine.mrp,
        isLowStock:    Number(stockQuantity) <= LOW_STOCK_THRESHOLD,
      });
    }

    await medicine.save();
    await invalidateStoreCache(storeId);

    const populatedMedicine = await Medicine.findById(medicine._id)
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .lean();

    logAudit('STOCK_ADDED', { medicineId: medicine._id, storeId, batchNumber, quantity: stockQuantity, staffId: req.user._id });
    await sysLog(req, {
      level: 'success', category: 'system',
      message: `Stock added: ${medicine.brandName || medicine.name} — ${stockQuantity} units (batch: ${batchNumber})`,
      relatedEntity: { model: 'PharmacyStore', entityId: storeId },
      metadata: { medicineId: medicine._id, batchNumber, stockQuantity },
    });

    const updatedEntry = medicine.inventory.find((inv) => inv.storeId.equals(storeId) && inv.batchNumber === batchNumber);
    if (updatedEntry && updatedEntry.stockQuantity <= LOW_STOCK_THRESHOLD) {
      dispatchLowStockAlert(medicine, storeId, updatedEntry.stockQuantity, req.user._id);
    }

    res.status(200).json({ success: true, message: 'Stock updated successfully.', data: { medicine: populatedMedicine } });
  })
);

/**
 * [16] PATCH /medicines/:medicineId/deduct-stock
 */
router.patch('/medicines/:medicineId/deduct-stock', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { quantity, batchNumber, reason = '' } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ success: false, message: 'quantity must be > 0.' });
    const medicine = await Medicine.findById(req.params.medicineId);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    const storeId = req.pharmacy.store._id;
    const filter  = batchNumber
      ? (inv) => inv.storeId.equals(storeId) && inv.batchNumber === batchNumber
      : (inv) => inv.storeId.equals(storeId);
    const idx = medicine.inventory.findIndex(filter);
    if (idx < 0) return res.status(404).json({ success: false, message: 'Inventory entry not found.' });
    if (medicine.inventory[idx].stockQuantity < quantity) return res.status(400).json({ success: false, message: 'Insufficient stock.' });

    medicine.inventory[idx].stockQuantity -= quantity;
    medicine.inventory[idx].isLowStock    = medicine.inventory[idx].stockQuantity <= LOW_STOCK_THRESHOLD;

    await medicine.save();
    await invalidateStoreCache(storeId);

    const populatedMedicine = await Medicine.findById(medicine._id)
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .lean();

    logAudit('STOCK_DEDUCTED', { medicineId: medicine._id, batchNumber, quantity, reason });
    await sysLog(req, {
      level: 'info', category: 'system',
      message: `Stock deducted: ${medicine.brandName || medicine.name} — ${quantity} units`,
      relatedEntity: { model: 'PharmacyStore', entityId: storeId },
      metadata: { medicineId: medicine._id, batchNumber, quantity, reason, remaining: medicine.inventory[idx].stockQuantity },
    });

    if (medicine.inventory[idx].stockQuantity <= LOW_STOCK_THRESHOLD) {
      dispatchLowStockAlert(medicine, storeId, medicine.inventory[idx].stockQuantity, req.user._id);
    }

    res.status(200).json({ success: true, message: 'Stock deducted.', data: { medicine: populatedMedicine } });
  })
);

/**
 * [17] GET /medicines/:medicineId/stock
 */
router.get('/medicines/:medicineId/stock', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(30, (req) => `pharmacy:${req.pharmacy?.store?._id}:med-stock:${req.params.medicineId}`),
  asyncHandler(async (req, res) => {
    const storeId  = req.pharmacy.store._id;
    const medicine = await Medicine.findById(req.params.medicineId)
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .lean();
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    const storeInventory = (medicine.inventory || []).filter((inv) => inv.storeId.equals(storeId));
    const totalStock     = storeInventory.reduce((sum, inv) => sum + (inv.stockQuantity || 0), 0);
    res.status(200).json({
      success: true,
      data: { medicineId: medicine._id, name: medicine.name, brandName: medicine.brandName, mrp: medicine.mrp, storeInventory, totalStock, isLowStock: totalStock <= LOW_STOCK_THRESHOLD },
    });
  })
);

/**
 * [18] GET /inventory/batches
 */
router.get('/inventory/batches', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:batches:${JSON.stringify(req.query)}`),
  asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const { page, limit, skip } = getPagination(req.query);
    const pipeline = [
      { $match: { 'inventory.storeId': storeId } },
      { $unwind: '$inventory' },
      { $match: { 'inventory.storeId': storeId } },
      { $project: { medicineId: '$_id', name: 1, brandName: 1, category: 1, hsnCode: 1, batchNumber: '$inventory.batchNumber', stockQuantity: '$inventory.stockQuantity', expiryDate: '$inventory.expiryDate', pricePerUnit: '$inventory.pricePerUnit', isLowStock: '$inventory.isLowStock', _id: 0 } },
      { $sort: { expiryDate: 1 } },
    ];
    const [batches, countResult] = await Promise.all([
      Medicine.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
      Medicine.aggregate([...pipeline, { $count: 'total' }]),
    ]);

    await Medicine.populate(batches, {
      path:   'hsnCode',
      select: 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage',
    });

    res.status(200).json({ success: true, data: { batches, pagination: { currentPage: page, totalPages: Math.ceil((countResult[0]?.total || 0) / limit), totalItems: countResult[0]?.total || 0 } } });
  })
);

/**
 * [19] GET /inventory/expiry-alerts
 */
router.get('/inventory/expiry-alerts', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(120, (req) => `pharmacy:${req.pharmacy?.store?._id}:expiry-alerts`),
  asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const days    = parseInt(req.query.days, 10) || EXPIRY_ALERT_DAYS;
    const cutoff  = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const expiring = await Medicine.aggregate([
      { $match: { 'inventory.storeId': storeId } },
      { $unwind: '$inventory' },
      { $match: { 'inventory.storeId': storeId, 'inventory.expiryDate': { $lte: cutoff, $gte: new Date() }, 'inventory.stockQuantity': { $gt: 0 } } },
      { $project: { medicineId: '$_id', name: 1, brandName: 1, category: 1, batchNumber: '$inventory.batchNumber', stockQuantity: '$inventory.stockQuantity', expiryDate: '$inventory.expiryDate', daysLeft: { $ceil: { $divide: [{ $subtract: ['$inventory.expiryDate', new Date()] }, 86400000] } }, _id: 0 } },
      { $sort: { expiryDate: 1 } },
    ]);
    if (req.query.sendEmail === 'true' && expiring.length > 0) {
      const pharmacyUser = await User.findById(req.user._id).select('email name').lean();
      if (pharmacyUser?.email) {
        const html = buildBatchExpiryAlertEmail({ userName: pharmacyUser.name, storeName: req.pharmacy.store.storeName, items: expiring, days });
        sendEmail({ email: pharmacyUser.email, subject: `[Likeson Healthcare] ⚠️ ${expiring.length} medicine(s) expiring within ${days} days`, html }).catch((err) => logError('EXPIRY_ALERT_EMAIL', err));
      }
    }
    res.status(200).json({ success: true, data: { expiringMedicines: expiring, count: expiring.length, alertDays: days } });
  })
);

/**
 * [20] GET /inventory/low-stock
 */
router.get('/inventory/low-stock', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:low-stock`),
  asyncHandler(async (req, res) => {
    const storeId   = req.pharmacy.store._id;
    const threshold = parseInt(req.query.threshold, 10) || LOW_STOCK_THRESHOLD;
    const lowStockItems = await Medicine.aggregate([
      { $match: { 'inventory.storeId': storeId } },
      { $unwind: '$inventory' },
      { $match: { 'inventory.storeId': storeId, 'inventory.stockQuantity': { $lte: threshold } } },
      { $project: { medicineId: '$_id', name: 1, brandName: 1, category: 1, batchNumber: '$inventory.batchNumber', stockQuantity: '$inventory.stockQuantity', expiryDate: '$inventory.expiryDate', pricePerUnit: '$inventory.pricePerUnit', _id: 0 } },
      { $sort: { stockQuantity: 1 } },
    ]);
    if (req.query.sendEmail === 'true' && lowStockItems.length > 0) {
      const pharmacyUser = await User.findById(req.user._id).select('email name').lean();
      if (pharmacyUser?.email) {
        const html = buildLowStockAlertEmail({ userName: pharmacyUser.name, storeName: req.pharmacy.store.storeName, items: lowStockItems, threshold });
        sendEmail({ email: pharmacyUser.email, subject: `[Likeson Healthcare] 🔴 ${lowStockItems.length} medicine(s) running low`, html }).catch((err) => logError('LOW_STOCK_EMAIL', err));
      }
    }
    res.status(200).json({ success: true, data: { lowStockItems, count: lowStockItems.length, threshold } });
  })
);

/**
 * [21] POST /medicines/:medicineId/request-stock
 */
router.post('/medicines/:medicineId/request-stock', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { requiredQuantity, urgency = 'Medium' } = req.body;
    if (!requiredQuantity || requiredQuantity <= 0) return res.status(400).json({ success: false, message: 'requiredQuantity must be > 0.' });
    if (!['Low', 'Medium', 'High', 'Critical'].includes(urgency)) return res.status(400).json({ success: false, message: 'Invalid urgency.' });
    const medicine = await Medicine.findById(req.params.medicineId);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    logAudit('STOCK_REQUESTED', { medicineId: medicine._id, storeId: req.pharmacy.store._id, requiredQuantity, urgency, staffId: req.user._id });
    await sysLog(req, { level: 'info', category: 'system', message: `Restock request: ${medicine.brandName || medicine.name} — ${requiredQuantity} units (${urgency})`, relatedEntity: { model: 'PharmacyStore', entityId: req.pharmacy.store._id }, metadata: { medicineId: medicine._id, requiredQuantity, urgency } });
    res.status(200).json({ success: true, message: 'Stock replenishment request submitted.', data: { medicineId: req.params.medicineId, medicineName: medicine.brandName || medicine.name, requiredQuantity, urgency } });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION D — FINANCIAL REPORTS & EARNINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/financials/daily', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(120, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:daily:${req.query.date || 'today'}`),
  asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const day     = req.query.date ? new Date(req.query.date) : new Date();
    const start   = new Date(day); start.setHours(0, 0, 0, 0);
    const end     = new Date(day); end.setHours(23, 59, 59, 999);
    const [orders, revenue, statusBreak] = await Promise.all([
      PharmacyOrder.countDocuments({ store: storeId, isArchived: false, createdAt: { $gte: start, $lte: end } }),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: start, $lte: end } } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, orderCount: { $sum: 1 } } }]),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, createdAt: { $gte: start, $lte: end } } }, { $group: { _id: '$delivery.status', count: { $sum: 1 } } }]),
    ]);
    const fin   = revenue[0] || {};
    const stats = statusBreak.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
    res.status(200).json({ success: true, data: { date: day.toISOString().split('T')[0], totalOrders: orders, grossRevenue: fin.grossRevenue || 0, gstCollected: fin.gstCollected || 0, discounts: fin.discounts || 0, netRevenue: (fin.grossRevenue || 0) - (fin.gstCollected || 0), paidOrders: fin.orderCount || 0, statusBreakdown: stats } });
  })
);

router.get('/financials/monthly', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(300, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:monthly:${req.query.month || 'current'}`),
  asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    let year, month;
    if (req.query.month) { [year, month] = req.query.month.split('-').map(Number); }
    else { const now = new Date(); year = now.getFullYear(); month = now.getMonth() + 1; }
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59, 999);
    const [summary, byDay] = await Promise.all([
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: start, $lte: end } } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, orderCount: { $sum: 1 } } }]),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$billing.totalPayable' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    const fin = summary[0] || {};
    res.status(200).json({ success: true, data: { month: `${year}-${String(month).padStart(2, '0')}`, grossRevenue: fin.grossRevenue || 0, gstCollected: fin.gstCollected || 0, discounts: fin.discounts || 0, netRevenue: (fin.grossRevenue || 0) - (fin.gstCollected || 0), totalOrders: fin.orderCount || 0, dailyBreakdown: byDay } });
  })
);

/**
 * [24] GET /financials/total
 * FIX: Aggregation used '$items.medicineId' but the schema field is 'items.medicine'.
 *      Changed _id grouping key to '$items.medicine' throughout all medicine aggregations.
 */
router.get('/financials/total', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(600, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:total`),
  asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const [lifetime, byMonth, topMedicines] = await Promise.all([
      PharmacyOrder.aggregate([
        { $match: { store: storeId, isArchived: false, 'payment.status': 'Paid' } },
        { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, totalOrders: { $sum: 1 } } },
      ]),
      PharmacyOrder.aggregate([
        { $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$billing.totalPayable' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // FIX: was '$items.medicineId' — correct field name is '$items.medicine'
      PharmacyOrder.aggregate([
        { $match: { store: storeId, isArchived: false, 'payment.status': 'Paid' } },
        { $unwind: '$items' },
        {
          $group: {
            _id:          '$items.medicine',   // ← FIX
            name:         { $first: '$items.name' },
            brandName:    { $first: '$items.brandName' },
            totalQty:     { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.pricePerUnit', '$items.quantity'] } },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),
    ]);
    const fin = lifetime[0] || {};
    res.status(200).json({ success: true, data: { grossRevenue: fin.grossRevenue || 0, gstCollected: fin.gstCollected || 0, discounts: fin.discounts || 0, netRevenue: (fin.grossRevenue || 0) - (fin.gstCollected || 0), totalOrders: fin.totalOrders || 0, monthlyTrend: byMonth, topMedicines } });
  })
);

router.get('/financials/history', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:history:${JSON.stringify(req.query)}`),
  asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days', startDate, endDate, paymentMethod } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const storeId   = req.pharmacy.store._id;
    const dateRange = parseDateFilter(dateFilter, startDate, endDate);
    const filter    = { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange };
    if (paymentMethod) filter['payment.method'] = paymentMethod;
    const [orders, totalCount, summary] = await Promise.all([
      PharmacyOrder.find(filter).select('orderId billing payment delivery.status createdAt customer store').populate('customer', 'name phone').populate('store', 'storeName address contact').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PharmacyOrder.countDocuments(filter),
      PharmacyOrder.aggregate([{ $match: filter }, { $group: { _id: null, totalRevenue: { $sum: '$billing.totalPayable' }, totalGst: { $sum: '$billing.gstAmount' }, totalDiscount: { $sum: '$billing.discountAmount' } } }]),
    ]);
    res.status(200).json({ success: true, data: { orders, summary: summary[0] || { totalRevenue: 0, totalGst: 0, totalDiscount: 0 }, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalItems: totalCount } } });
  })
);

router.get('/financials/store-invoice', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days', startDate, endDate } = req.query;
    const storeId   = req.pharmacy.store._id;
    const dateRange = parseDateFilter(dateFilter, startDate, endDate);
    const [store, orders, summary] = await Promise.all([
      PharmacyStore.findById(storeId).lean(),
      PharmacyOrder.find({ store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange }).select('orderId billing payment delivery.status createdAt').sort({ createdAt: -1 }).lean(),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, totalOrders: { $sum: 1 } } }]),
    ]);
    const html = buildStoreInvoiceHtml({ store, orders, summary: summary[0] || {}, dateRange: { start: dateRange.$gte, end: dateRange.$lte }, generatedBy: req.user });
    res.status(200).send(html);
  })
);

router.post('/financials/store-invoice/send', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days', startDate, endDate, recipientEmail } = req.body;
    const storeId   = req.pharmacy.store._id;
    const dateRange = parseDateFilter(dateFilter, startDate, endDate);
    const [store, orders, summary] = await Promise.all([
      PharmacyStore.findById(storeId).lean(),
      PharmacyOrder.find({ store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange }).select('orderId billing payment delivery.status createdAt').sort({ createdAt: -1 }).lean(),
      PharmacyOrder.aggregate([{ $match: { store: storeId, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } }, { $group: { _id: null, grossRevenue: { $sum: '$billing.totalPayable' }, gstCollected: { $sum: '$billing.gstAmount' }, discounts: { $sum: '$billing.discountAmount' }, totalOrders: { $sum: 1 } } }]),
    ]);
    const html    = buildStoreInvoiceHtml({ store, orders, summary: summary[0] || {}, dateRange: { start: dateRange.$gte, end: dateRange.$lte }, generatedBy: req.user });
    const toEmail = recipientEmail || (await User.findById(req.user._id).select('email').lean())?.email;
    if (!toEmail) return res.status(400).json({ success: false, message: 'Recipient email not found.' });
    await sendEmail({ email: toEmail, subject: `[Likeson Healthcare] Store Invoice — ${store?.storeName}`, html });
    res.status(200).json({ success: true, message: `Store invoice sent to ${toEmail}.` });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION E — BANK SETTLEMENTS & PAYMENT ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/financials/payment-account', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    let account = await PaymentAccount.findOne({ user: req.user._id }).lean();
    if (!account) account = await PaymentAccount.create({ user: req.user._id });
    res.status(200).json({ success: true, data: { account } });
  })
);

router.post('/financials/payment-account/bank', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType, isPrimary, cancelledChequeUrl } = req.body;
    if (!accountHolderName || !accountNumber || !ifscCode) return res.status(400).json({ success: false, message: 'accountHolderName, accountNumber, and ifscCode are required.' });
    let account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) account = new PaymentAccount({ user: req.user._id });
    if (isPrimary) account.bankAccounts.forEach((b) => { b.isPrimary = false; });
    account.bankAccounts.push({ accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType: accountType || 'Current', isPrimary: isPrimary || account.bankAccounts.length === 0, cancelledChequeUrl });
    await account.save();
    await sysLog(req, { level: 'info', category: 'user', message: 'Bank account added', metadata: { bankName, ifscCode } });
    res.status(201).json({ success: true, message: 'Bank account added.', data: { account } });
  })
);

router.patch('/financials/payment-account/bank/:bankId', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    const bank = account.bankAccounts.id(req.params.bankId);
    if (!bank)    return res.status(404).json({ success: false, message: 'Bank account not found.' });
    const { accountHolderName, ifscCode, bankName, branchName, accountType, isPrimary, cancelledChequeUrl } = req.body;
    if (isPrimary) account.bankAccounts.forEach((b) => { b.isPrimary = false; });
    if (accountHolderName)  bank.accountHolderName  = accountHolderName;
    if (ifscCode)           bank.ifscCode           = ifscCode;
    if (bankName)           bank.bankName           = bankName;
    if (branchName)         bank.branchName         = branchName;
    if (accountType)        bank.accountType        = accountType;
    if (cancelledChequeUrl) bank.cancelledChequeUrl = cancelledChequeUrl;
    if (typeof isPrimary === 'boolean') bank.isPrimary = isPrimary;
    await account.save();
    res.status(200).json({ success: true, message: 'Bank account updated.', data: { account } });
  })
);

router.delete('/financials/payment-account/bank/:bankId', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    account.bankAccounts.pull({ _id: req.params.bankId });
    await account.save();
    res.status(200).json({ success: true, message: 'Bank account removed.' });
  })
);

router.post('/financials/payment-account/upi', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { upiId, upiName, isPrimary } = req.body;
    if (!upiId) return res.status(400).json({ success: false, message: 'upiId is required.' });
    let account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) account = new PaymentAccount({ user: req.user._id });
    if (isPrimary) account.upiHandles.forEach((u) => { u.isPrimary = false; });
    account.upiHandles.push({ upiId, upiName, isPrimary: isPrimary || account.upiHandles.length === 0 });
    await account.save();
    res.status(201).json({ success: true, message: 'UPI handle added.', data: { account } });
  })
);

router.delete('/financials/payment-account/upi/:upiId', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    account.upiHandles.pull({ _id: req.params.upiId });
    await account.save();
    res.status(200).json({ success: true, message: 'UPI handle removed.' });
  })
);

router.get('/financials/settlements', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(120, (req) => `pharmacy:${req.pharmacy?.store?._id}:settlements`),
  asyncHandler(async (req, res) => {
    const account = await PaymentAccount.findOne({ user: req.user._id }).lean();
    res.status(200).json({ success: true, data: { pendingBalance: account?.pendingBalance || 0, totalEarned: account?.totalEarned || 0, totalSettled: account?.totalSettled || 0, totalDeductions: account?.totalDeductions || 0, preferredPayoutMethod: account?.preferredPayoutMethod || 'Bank Transfer', payoutCycle: account?.payoutCycle || 'Weekly', primaryBank: account?.bankAccounts?.find(b => b.isPrimary) || null, primaryUpi: account?.upiHandles?.find(u => u.isPrimary) || null, settlementHistory: (account?.settlementHistory || []).slice(-20) } });
  })
);

router.post('/financials/settlements/request', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { amount, method, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required.' });
    const account = await PaymentAccount.findOne({ user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Payment account not found.' });
    if (amount > account.pendingBalance) return res.status(400).json({ success: false, message: `Requested amount exceeds pending balance of ₹${account.pendingBalance}.` });
    account.pendingBalance = parseFloat((account.pendingBalance - amount).toFixed(2));
    account.totalSettled   = parseFloat((account.totalSettled   + amount).toFixed(2));
    account.lastSettledAt  = new Date();
    account.settlementHistory.push({ amount, method: method || account.preferredPayoutMethod || 'Bank Transfer', note: note || '', settledAt: new Date(), settledBy: req.user._id });
    await account.save();
    await sysLog(req, { level: 'success', category: 'payment', message: `Settlement ₹${amount} requested by ${req.user.name}`, metadata: { amount, method, storeId: req.pharmacy.store._id } });
    const pharmacyUser = await User.findById(req.user._id).select('email name').lean();
    if (pharmacyUser?.email) {
      const html = buildSettlementEmail({ userName: pharmacyUser.name, amount, method: method || account.preferredPayoutMethod, storeName: req.pharmacy.store.storeName, settledAt: new Date(), remaining: account.pendingBalance });
      sendEmail({ email: pharmacyUser.email, subject: `[Likeson Healthcare] Settlement of ₹${amount} processed`, html }).catch((err) => logError('SETTLEMENT_EMAIL', err));
    }
    logAudit('SETTLEMENT_REQUESTED', { storeId: req.pharmacy.store._id, amount });
    res.status(200).json({ success: true, message: `Settlement of ₹${amount} recorded.`, data: { pendingBalance: account.pendingBalance, totalSettled: account.totalSettled } });
  })
);

router.get('/financials/settlements/history', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const account = await PaymentAccount.findOne({ user: req.user._id }).lean();
    if (!account) return res.status(200).json({ success: true, data: { history: [], pagination: {} } });
    const history    = account.settlementHistory || [];
    const totalCount = history.length;
    const paginated  = [...history].reverse().slice(skip, skip + limit);
    res.status(200).json({ success: true, data: { history: paginated, pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalItems: totalCount } } });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION F — ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/analytics/overview', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:overview:${req.query.dateFilter}`),
  asyncHandler(async (req, res) => {
    const { dateFilter = 'today' } = req.query;
    const dateRange = parseDateFilter(dateFilter);
    const filter    = { store: req.pharmacy.store._id, isArchived: false, createdAt: dateRange };
    const [totalOrders, revenueData, statusBreakdown] = await Promise.all([
      PharmacyOrder.countDocuments(filter),
      PharmacyOrder.aggregate([{ $match: { ...filter, 'payment.status': 'Paid' } }, { $group: { _id: null, total: { $sum: '$billing.totalPayable' }, gst: { $sum: '$billing.gstAmount' } } }]),
      PharmacyOrder.aggregate([{ $match: filter }, { $group: { _id: '$delivery.status', count: { $sum: 1 } } }]),
    ]);
    res.status(200).json({ success: true, data: { totalOrders, totalRevenue: revenueData[0]?.total || 0, gstCollected: revenueData[0]?.gst || 0, statusBreakdown: statusBreakdown.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}) } });
  })
);

router.get('/analytics/revenue', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(180, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:revenue:${req.query.dateFilter}`),
  asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days' } = req.query;
    const dateRange    = parseDateFilter(dateFilter);
    const revenueByDay = await PharmacyOrder.aggregate([{ $match: { store: req.pharmacy.store._id, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$billing.totalPayable' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    res.status(200).json({ success: true, data: { revenueByDay } });
  })
);

router.get('/analytics/returns', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(180, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:returns:${req.query.dateFilter}`),
  asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days' } = req.query;
    const dateRange     = parseDateFilter(dateFilter);
    const returnMetrics = await PharmacyOrder.aggregate([{ $match: { store: req.pharmacy.store._id, isArchived: false, 'delivery.status': { $in: ['Return_Requested', 'Return_Accepted', 'Returned'] }, createdAt: dateRange } }, { $group: { _id: '$delivery.status', count: { $sum: 1 }, totalValue: { $sum: '$billing.totalPayable' } } }]);
    res.status(200).json({ success: true, data: { returnMetrics } });
  })
);

/**
 * [40] GET /analytics/top-medicines
 * FIX: was '$items.medicineId' — correct field name is '$items.medicine'
 */
router.get('/analytics/top-medicines', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(300, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:top-medicines:${req.query.dateFilter}`),
  asyncHandler(async (req, res) => {
    const { dateFilter = 'last30days' } = req.query;
    const dateRange    = parseDateFilter(dateFilter);
    const topMedicines = await PharmacyOrder.aggregate([
      { $match: { store: req.pharmacy.store._id, isArchived: false, 'payment.status': 'Paid', createdAt: dateRange } },
      { $unwind: '$items' },
      {
        $group: {
          _id:          '$items.medicine',    // ← FIX
          name:         { $first: '$items.name' },
          brandName:    { $first: '$items.brandName' },
          totalQty:     { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.pricePerUnit', '$items.quantity'] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(req.query.limit, 10) || 10 },
    ]);
    res.status(200).json({ success: true, data: { topMedicines } });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION G — PROFILE & STORE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/profile', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({ success: true, data: { user } });
  })
);

router.put('/profile', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { name, phone, avatar } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { ...(name && { name }), ...(phone && { phone }), ...(avatar && { avatar }) }, { new: true }).select('-password');
    await sysLog(req, { level: 'info', category: 'user', message: `Profile updated by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'Profile updated.', data: { user } });
  })
);

router.put('/profile/password', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: 'All fields required.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be 8+ characters.' });
    const user  = await User.findById(req.user._id);
    const valid = await user.matchPassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect.' });
    user.password = newPassword;
    await user.save();
    await sysLog(req, { level: 'success', category: 'auth', message: `Password changed by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'Password changed.' });
  })
);

router.get('/profile/pharmacy', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const pharmacyProfile = await PharmacyProfile.findOne({ user: req.user._id }).populate('assignedStore');
    res.status(200).json({ success: true, data: { pharmacyProfile } });
  })
);

router.put('/profile/pharmacy', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { experienceYears, qualification } = req.body;
    const pharmacyProfile = await PharmacyProfile.findOneAndUpdate(
      { user: req.user._id },
      { ...(typeof experienceYears === 'number' && { experienceYears }), ...(qualification && { qualification }) },
      { new: true }
    );
    res.status(200).json({ success: true, message: 'Pharmacy profile updated.', data: { pharmacyProfile } });
  })
);

router.get('/store', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: { store: req.pharmacy.store } });
  })
);

router.put('/store', protect, authorize('pharmacy'), attachPharmacyStore,
  asyncHandler(async (req, res) => {
    const { deliveryRadiusKm, estimatedDeliveryTime, timings, status } = req.body;
    const store = await PharmacyStore.findByIdAndUpdate(
      req.pharmacy.store._id,
      {
        ...(typeof deliveryRadiusKm === 'number' && { 'deliverySettings.deliveryRadiusKm': deliveryRadiusKm }),
        ...(estimatedDeliveryTime && { 'deliverySettings.estimatedDeliveryTime': estimatedDeliveryTime }),
        ...(timings && { timings }),
        ...(status && { status }),
      },
      { new: true }
    );
    await invalidateStoreCache(req.pharmacy.store._id);
    await sysLog(req, { level: 'info', category: 'system', message: `Store settings updated: ${req.pharmacy.store.storeName}`, relatedEntity: { model: 'PharmacyStore', entityId: req.pharmacy.store._id } });
    res.status(200).json({ success: true, message: 'Store updated.', data: { store } });
  })
);

router.get('/store/inventory-summary', protect, authorize('pharmacy'), attachPharmacyStore,
  cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:inv-summary`),
  asyncHandler(async (req, res) => {
    const storeId = req.pharmacy.store._id;
    const now     = new Date();
    const cutoff  = new Date();
    cutoff.setDate(cutoff.getDate() + EXPIRY_ALERT_DAYS);

    const [totals, lowStock, expiringSoon] = await Promise.all([
      Medicine.aggregate([
        { $match: { 'inventory.storeId': storeId } },
        { $unwind: '$inventory' },
        { $match: { 'inventory.storeId': storeId } },
        { $group: { _id: null, totalSKUs: { $sum: 1 }, totalUnits: { $sum: '$inventory.stockQuantity' } } },
      ]),
      Medicine.countDocuments({ 'inventory.storeId': storeId, 'inventory.stockQuantity': { $lte: LOW_STOCK_THRESHOLD } }),
      Medicine.countDocuments({ 'inventory.storeId': storeId, 'inventory.expiryDate': { $gte: now, $lte: cutoff } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSKUs:         totals[0]?.totalSKUs  || 0,
        totalUnits:        totals[0]?.totalUnits || 0,
        lowStockCount:     lowStock,
        expiringSoonCount: expiringSoon,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        expiryAlertDays:   EXPIRY_ALERT_DAYS,
      },
    });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// ▶▶ SECTION H — AUDIT: SESSIONS & DEVICES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/audit/sessions', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions');
    res.status(200).json({ success: true, data: { sessions: user?.auditSessions || [] } });
  })
);

router.delete('/audit/sessions/:sessionId', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $pull: { auditSessions: { _id: req.params.sessionId } } });
    await sysLog(req, { level: 'info', category: 'security', message: `Session ${req.params.sessionId} revoked` });
    res.status(200).json({ success: true, message: 'Session revoked.' });
  })
);

router.delete('/audit/all-sessions', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { auditSessions: [] });
    await sysLog(req, { level: 'warning', category: 'security', message: `All sessions revoked by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'All sessions revoked.' });
  })
);

router.get('/audit/devices', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('deviceTokens');
    res.status(200).json({ success: true, data: { devices: user?.deviceTokens || [] } });
  })
);

router.delete('/audit/devices/:deviceId', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $pull: { deviceTokens: { _id: req.params.deviceId } } });
    await sysLog(req, { level: 'info', category: 'security', message: `Device ${req.params.deviceId} removed` });
    res.status(200).json({ success: true, message: 'Device removed.' });
  })
);

router.delete('/audit/devices', protect, authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { deviceTokens: [] });
    await sysLog(req, { level: 'warning', category: 'security', message: `All devices removed by ${req.user.name}` });
    res.status(200).json({ success: true, message: 'All devices removed.' });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  logError('UNHANDLED_ERROR', err, { path: req.originalUrl, method: req.method });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Validation Error', details: Object.values(err.errors).map((e) => e.message) });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `Duplicate entry for ${field}.` });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: `File size must not exceed ${MAX_FILE_SIZE_MB} MB.` });
  }
  if (err.isAxiosError) {
    return res.status(502).json({ success: false, message: 'Upstream service error.', detail: process.env.NODE_ENV === 'development' ? err.response?.data || err.message : undefined });
  }

  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

export default router;