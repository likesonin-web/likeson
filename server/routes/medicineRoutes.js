import express          from 'express';
import slugify          from 'slugify';
import mongoose         from 'mongoose';
import multer           from 'multer';
import axios            from 'axios';
import FormData         from 'form-data';
import xlsx             from 'xlsx';
import * as pdfParse from 'pdf-parse';

import Medicine         from '../models/Medicine.js';
import HsnCode          from '../models/HsnCode.js';
import User             from '../models/User.js';
import Notification     from '../models/Notification.js';
import PharmacyProfile  from '../models/PharmacyProfile.js';
import PharmacyStore    from '../models/PharmacyStore.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler     from '../utils/asyncHandler.js';
import sendEmail        from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';
import redisClient      from '../config/redis.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CONSTANTS & CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const VALID_GST_SLABS  = [0, 5, 12, 18, 28];
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_BYTES   = MAX_FILE_SIZE_MB * 1024 * 1024;
const LOW_STOCK_THRESHOLD = 10; // send daily email if stock <= this value

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
  description:    ['description', 'desc', 'product description', 'item description', 'product desc'],
  chapterHeading: ['chapter heading', 'chapter', 'heading', 'chapter_heading'],
  gstPercentage:  ['gst %', 'gst%', 'gst percentage', 'tax %', 'rate', 'igst %', 'gst rate', 'tax rate'],
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const auditLog = (action, userId, metadata = {}) => {
  const entry = {
    timestamp:   new Date().toISOString(),
    action,
    performedBy: userId || 'system',
    metadata,
    environment: process.env.NODE_ENV || 'development',
    service:     'medicine-router',
  };
  console.log(`[AUDIT_LOG] ${JSON.stringify(entry)}`);
};

const getDashboardLink = (role, path) => {
  const baseUrls = {
    superadmin: 'https://likeson.in/super-admin',
    admin:      'https://likeson.in/admin',
    pharmacy:   'https://likeson.in/pharmacy',
  };
  return `${baseUrls[role] || 'https://likeson.in/dashboard'}${path}`;
};

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const resolveHsnCodeId = async (value, session = null) => {
  if (!value) return undefined;

  if (OBJECT_ID_REGEX.test(String(value))) {
    return value;
  }

  const normalized = String(value).toUpperCase().replace(/\s/g, '').trim();
  const opts = session ? { session } : {};
  const hsn = await HsnCode.findOne({ hsnCode: normalized, isActive: true }, '_id', opts);

  if (!hsn) {
    throw new Error(
      `HSN code '${normalized}' not found or is inactive. ` +
      `Upload it first via POST /api/v1/medicines/hsn/upload or POST /api/v1/medicines/hsn.`
    );
  }

  return hsn._id;
};

 
// CORRECTED: Two separate helpers — bulk sync & single store opt-in
// ─────────────────────────────────────────────────────────────────────────────

/**
 * syncInventoryAllStores
 *
 * Ensures every active (non-Inactive) PharmacyStore has a zero-stock
 * placeholder entry on the medicine. Stores that already have an entry
 * are NEVER touched — only missing ones are inserted.
 *
 * Returns the count of NEW entries added.
 */
const syncInventoryAllStores = async (medicine, actorId, session = null) => {
  const opts = session ? { session } : {};

  const stores = await PharmacyStore.find(
    { status: { $ne: 'Inactive' } },
    '_id',
    opts
  ).lean();

  // Build a Set of storeId strings already present on this medicine
  const existing = new Set(
    medicine.inventory.map((inv) => inv.storeId.toString())
  );

  let added = 0;
  const expiryFallback = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  for (const store of stores) {
    const sid = store._id.toString();
    if (existing.has(sid)) continue; // ← NEVER overwrite existing stock

    medicine.inventory.push({
      storeId:          store._id,
      addedBy:          actorId,
      updatedBy:        actorId,
      stockQuantity:    0,
      reservedQuantity: 0,
      reorderLevel:     10,
      expiryDate:       expiryFallback,
      batchNumber:      null,
      pricePerUnit:     medicine.mrp,
      isLowStock:       true,   // 0 <= 10
      isExpired:        false,
      isActive:         true,
    });
    added++;
  }

  return added; // ← returns NUMBER — callers check `if (added > 0)`
};

/**
 * addStoreInventory
 *
 * Opts a SINGLE specific store into a medicine's inventory.
 * Called from INV3 POST /:id/inventory and the pharmacy role in M5/M6.
 * Returns { added: boolean, inventory?: Object, message?: string }
 */
const addStoreInventory = async (
  medicine,
  storeId,
  actorId,
  overrides = {},
  session = null
) => {
  const opts = session ? { session } : {};

  const store = await PharmacyStore.findOne(
    { _id: storeId, status: { $ne: 'Inactive' } },
    '_id',
    opts
  ).lean();

  if (!store) {
    throw new Error(`Store ${storeId} not found or is inactive`);
  }

  const alreadyExists = medicine.inventory.some(
    (inv) => inv.storeId.toString() === storeId.toString()
  );

  if (alreadyExists) {
    return {
      added:   false,
      message: `Store ${storeId} already has an inventory entry for this medicine`,
    };
  }

  const expiryFallback = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // Destructure sensitive fields out so overrides can't clobber them
  const { storeId: _s, addedBy: _a, updatedBy: _u, ...safeOverrides } = overrides;

  const newEntry = {
    storeId,
    addedBy:          actorId,
    updatedBy:        actorId,
    stockQuantity:    0,
    reservedQuantity: 0,
    reorderLevel:     10,
    expiryDate:       expiryFallback,
    batchNumber:      null,
    pricePerUnit:     medicine.mrp,
    isLowStock:       true,
    isExpired:        false,
    isActive:         true,
    ...safeOverrides,  // caller-supplied overrides (stock, expiry, batch, price, location)
  };

  medicine.inventory.push(newEntry);
  return { added: true, inventory: newEntry };
};
// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2b — STORE LIFECYCLE SYNC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * removeStoreFromAllMedicines
 *
 * Hard-removes every inventory entry for the given storeId across ALL
 * non-discontinued medicines. Called when a PharmacyStore is permanently
 * deleted.
 *
 * @param {string|ObjectId} storeId  - The store being deleted
 * @param {string|ObjectId} actorId  - User performing the action
 * @returns {number} count of medicines updated
 */
const removeStoreFromAllMedicines = async (storeId, actorId) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));

  const result = await Medicine.updateMany(
    { 'inventory.storeId': storeObjId, isDiscontinued: false },
    {
      $pull:  { inventory: { storeId: storeObjId } },
      $set:   { updatedBy: actorId },
    }
  );

  auditLog('STORE_DELETE_INVENTORY_PURGE', actorId, {
    storeId:          storeId.toString(),
    medicinesUpdated: result.modifiedCount,
  });

  return result.modifiedCount;
};

/**
 * suspendStoreInventory
 *
 * Soft-pauses every inventory entry for the given storeId by setting
 * isActive = false. The stock data is preserved for when the store
 * is unsuspended.
 *
 * @param {string|ObjectId} storeId
 * @param {string|ObjectId} actorId
 * @returns {number} medicines updated
 */
const suspendStoreInventory = async (storeId, actorId) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));

  const result = await Medicine.updateMany(
    { 'inventory.storeId': storeObjId },
    {
      $set: {
        'inventory.$[entry].isActive': false,
        updatedBy: actorId,
      },
    },
    { arrayFilters: [{ 'entry.storeId': storeObjId }] }
  );

  auditLog('STORE_SUSPENDED_INVENTORY_PAUSED', actorId, {
    storeId:          storeId.toString(),
    medicinesUpdated: result.modifiedCount,
  });

  return result.modifiedCount;
};

/**
 * resumeStoreInventory
 *
 * Re-activates every previously paused inventory entry for the given
 * storeId by setting isActive = true. Called when a store is unsuspended.
 * After resuming, checks for low stock and fires notifications + emails.
 *
 * @param {string|ObjectId} storeId
 * @param {string|ObjectId} actorId
 * @param {Document}        store    - The PharmacyStore document (for store name)
 * @returns {number} medicines updated
 */
const resumeStoreInventory = async (storeId, actorId, store) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));

  const result = await Medicine.updateMany(
    { 'inventory.storeId': storeObjId },
    {
      $set: {
        'inventory.$[entry].isActive': true,
        updatedBy: actorId,
      },
    },
    { arrayFilters: [{ 'entry.storeId': storeObjId }] }
  );

  auditLog('STORE_UNSUSPENDED_INVENTORY_RESUMED', actorId, {
    storeId:          storeId.toString(),
    medicinesUpdated: result.modifiedCount,
  });

  // Trigger low-stock notifications for the newly resumed store
  await triggerLowStockAlertsForStore(storeId, store, actorId);

  return result.modifiedCount;
};

/**
 * triggerLowStockAlertsForStore
 *
 * Finds all medicines at or below LOW_STOCK_THRESHOLD for a given store,
 * then:
 *   1. Creates in-app Notification records for all admin/superadmin users.
 *   2. Sends a rich HTML email (with medicine images) to the store's managing
 *      pharmacist and all admins.
 *
 * This is called:
 *   - On store unsuspension (to immediately surface any stale low-stock).
 *   - By the daily cron job (sendDailyLowStockEmails).
 *
 * @param {string|ObjectId} storeId
 * @param {Document|Object} store    - PharmacyStore document (needs storeName, contact.email)
 * @param {string|ObjectId} actorId
 */
const triggerLowStockAlertsForStore = async (storeId, store, actorId) => {
  const storeObjId = new mongoose.Types.ObjectId(String(storeId));

  // Fetch medicines with low/zero stock at this store
  const lowStockMedicines = await Medicine.aggregate([
    { $unwind: '$inventory' },
    {
      $match: {
        'inventory.storeId':       storeObjId,
        'inventory.isActive':      true,
        'inventory.stockQuantity': { $lte: LOW_STOCK_THRESHOLD },
        isDiscontinued:            false,
      },
    },
    {
      $project: {
        name:          1,
        brandName:     1,
        genericName:   1,
        mrp:           1,
        images:        1,
        packaging:     1,
        manufacturer:  1,
        inventory:     1,
      },
    },
    { $sort: { 'inventory.stockQuantity': 1 } },
  ]);

  if (lowStockMedicines.length === 0) return;

  // ── 1. In-app notifications ──────────────────────────────────────────────
  const [admins, pharmacyProfile] = await Promise.all([
    User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id'),
    PharmacyProfile.findOne({ assignedStore: storeObjId }).populate('user', '_id email name'),
  ]);

  const recipientIds = admins.map((a) => a._id);
  if (pharmacyProfile?.user?._id) {
    recipientIds.push(pharmacyProfile.user._id);
  }

  const notifications = recipientIds.map((recipientId) => ({
    recipient: recipientId,
    title:     `⚠️ Low Stock Alert — ${store.storeName}`,
    body:      `${lowStockMedicines.length} medicine(s) at ${store.storeName} have stock ≤ ${LOW_STOCK_THRESHOLD} units. Immediate restocking required.`,
    type:      'Medicine_Ready',
    priority:  'High',
    metadata:  {
      storeId:      storeId.toString(),
      storeName:    store.storeName,
      medicineCount: lowStockMedicines.length,
      triggeredBy:  actorId?.toString?.() || 'system',
    },
  }));

  await Notification.insertMany(notifications);

  // ── 2. Build rich HTML email with medicine images ────────────────────────
  const medicineRowsHtml = lowStockMedicines
    .map((med) => {
      const primaryImage = med.images?.find((img) => img.isPrimary)?.url
        || med.images?.[0]?.url
        || null;

      const imageTag = primaryImage
        ? `<img
             src="${primaryImage}"
             alt="${med.brandName}"
             width="60"
             height="60"
             style="border-radius:6px;object-fit:cover;border:1px solid #e2e8f0;"
           />`
        : `<div style="width:60px;height:60px;border-radius:6px;background:#f1f5f9;
                       display:flex;align-items:center;justify-content:center;
                       font-size:11px;color:#94a3b8;border:1px solid #e2e8f0;">
             No Image
           </div>`;

      const stockQty   = med.inventory?.stockQuantity ?? 0;
      const stockColor = stockQty === 0 ? '#dc2626' : '#d97706'; // red for zero, amber for low

      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px 8px;vertical-align:middle;">${imageTag}</td>
          <td style="padding:12px 8px;vertical-align:middle;">
            <div style="font-weight:600;color:#1e293b;font-size:14px;">${med.brandName}</div>
            <div style="color:#64748b;font-size:12px;margin-top:2px;">${med.genericName || ''}</div>
            <div style="color:#94a3b8;font-size:11px;">${med.packaging || ''}</div>
          </td>
          <td style="padding:12px 8px;vertical-align:middle;font-size:12px;color:#64748b;">
            ${med.manufacturer || '—'}
          </td>
          <td style="padding:12px 8px;vertical-align:middle;text-align:center;">
            <span style="
              background:${stockQty === 0 ? '#fef2f2' : '#fffbeb'};
              color:${stockColor};
              padding:3px 10px;
              border-radius:999px;
              font-weight:700;
              font-size:13px;
              border:1px solid ${stockQty === 0 ? '#fecaca' : '#fde68a'};
            ">${stockQty} units</span>
          </td>
          <td style="padding:12px 8px;vertical-align:middle;text-align:right;
                     font-weight:600;color:#1e293b;font-size:13px;">
            ₹${med.mrp?.toFixed(2) || '—'}
          </td>
        </tr>`;
    })
    .join('');

  const emailBody = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">

      <!-- Header banner -->
      <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);
                  padding:24px 28px;border-radius:10px 10px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
          ⚠️ Low Stock Alert
        </h1>
        <p style="margin:6px 0 0;color:#fecaca;font-size:14px;">
          ${store.storeName} — ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
        </p>
      </div>

      <!-- Summary card -->
      <div style="background:#fff;border:1px solid #e2e8f0;
                  border-top:none;padding:20px 28px;">
        <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
          The following <strong>${lowStockMedicines.length} medicine(s)</strong> at
          <strong>${store.storeName}</strong> currently have stock at or below
          <strong>${LOW_STOCK_THRESHOLD} units</strong>. Please restock immediately to avoid
          order fulfilment failures.
        </p>
      </div>

      <!-- Medicine table -->
      <div style="background:#fff;border:1px solid #e2e8f0;
                  border-top:none;padding:0 28px 20px;">
        <table width="100%" cellspacing="0" cellpadding="0"
               style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
              <th style="padding:10px 8px;text-align:left;color:#64748b;
                         font-weight:600;font-size:11px;text-transform:uppercase;
                         letter-spacing:0.5px;">Image</th>
              <th style="padding:10px 8px;text-align:left;color:#64748b;
                         font-weight:600;font-size:11px;text-transform:uppercase;
                         letter-spacing:0.5px;">Medicine</th>
              <th style="padding:10px 8px;text-align:left;color:#64748b;
                         font-weight:600;font-size:11px;text-transform:uppercase;
                         letter-spacing:0.5px;">Manufacturer</th>
              <th style="padding:10px 8px;text-align:center;color:#64748b;
                         font-weight:600;font-size:11px;text-transform:uppercase;
                         letter-spacing:0.5px;">Current Stock</th>
              <th style="padding:10px 8px;text-align:right;color:#64748b;
                         font-weight:600;font-size:11px;text-transform:uppercase;
                         letter-spacing:0.5px;">MRP</th>
            </tr>
          </thead>
          <tbody>${medicineRowsHtml}</tbody>
        </table>
      </div>

      <!-- CTA footer -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;
                  border-radius:0 0 10px 10px;padding:20px 28px;text-align:center;">
        <a href="${getDashboardLink('pharmacy', '/inventory')}"
           style="display:inline-block;background:#2563eb;color:#fff;
                  padding:12px 28px;border-radius:8px;text-decoration:none;
                  font-weight:600;font-size:14px;letter-spacing:0.2px;">
          Update Inventory Now
        </a>
        <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">
          You will receive this alert daily until stock is replenished above
          ${LOW_STOCK_THRESHOLD} units.
        </p>
      </div>

    </div>`;

  // Collect email addresses: admins + pharmacy manager
  const adminEmails = await User.find({ role: { $in: ['admin', 'superadmin'] } })
    .select('email')
    .lean();

  const emailAddresses = adminEmails.map((u) => u.email);
  if (store.contact?.email) emailAddresses.push(store.contact.email);
  if (pharmacyProfile?.user?.email) emailAddresses.push(pharmacyProfile.user.email);

  // Deduplicate
  const uniqueEmails = [...new Set(emailAddresses.filter(Boolean))];

  const emailPromises = uniqueEmails.map((email) =>
    sendEmail({
      email,
      subject: `[LOW STOCK] ${lowStockMedicines.length} medicine(s) need restocking — ${store.storeName}`,
      html:    emailBody,
    }).catch((err) => {
      console.error(`[LowStockEmail] Failed to send to ${email}:`, err.message);
    })
  );

  await Promise.allSettled(emailPromises);

  auditLog('LOW_STOCK_ALERT_SENT', actorId || 'system', {
    storeId:        storeId.toString(),
    storeName:      store.storeName,
    lowStockCount:  lowStockMedicines.length,
    emailsSent:     uniqueEmails.length,
    notificationsSent: notifications.length,
  });
};

/**
 * sendDailyLowStockEmails  (export for use in a cron job)
 *
 * Iterates all active stores and fires triggerLowStockAlertsForStore for
 * each one that has medicines below LOW_STOCK_THRESHOLD.
 *
 * Usage in your scheduler (e.g. node-cron):
 *
 *   import { sendDailyLowStockEmails } from './routes/medicineRouter.js';
 *   cron.schedule('0 8 * * *', sendDailyLowStockEmails);  // every day at 08:00
 */
export const sendDailyLowStockEmails = async () => {
  console.log('[DailyLowStock] Starting daily low-stock email run…');

  const stores = await PharmacyStore.find({ status: 'Open' }).lean();

  for (const store of stores) {
    try {
      await triggerLowStockAlertsForStore(store._id, store, 'system');
    } catch (err) {
      console.error(`[DailyLowStock] Error for store ${store._id}:`, err.message);
    }
  }

  console.log(`[DailyLowStock] Done — processed ${stores.length} store(s).`);
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — REDIS CACHE MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

const cache = (ttlSeconds = 60, keyFn = null) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const cacheKey = keyFn ? keyFn(req) : `${req.method}:${req.originalUrl}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (err) {
      console.error('[Cache READ error]', err.message);
    }

    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(body));
        } catch (err) {
          console.error('[Cache WRITE error]', err.message);
        }
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};

const invalidateHsnCache = async () => {
  try {
    const keys = await redisClient.keys('GET:*hsn*');
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) {
    console.error('[Cache INVALIDATE error]', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — MULTER
// ─────────────────────────────────────────────────────────────────────────────

const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, _file, cb) => cb(null, true),
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — IMAGEKIT UPLOAD HELPER
// ─────────────────────────────────────────────────────────────────────────────

const uploadToImageKit = async (buffer, fileName, folder = IMAGEKIT.folder) => {
  const formData = new FormData();
  formData.append('file',              buffer, { filename: fileName });
  formData.append('fileName',          fileName);
  formData.append('folder',            folder);
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

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — HSN PARSE & UPSERT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const normalizeHsnRow = (raw) => {
  const lower = {};
  for (const [k, v] of Object.entries(raw)) {
    lower[k.toLowerCase().trim()] = String(v ?? '').trim();
  }

  const get = (aliases) => {
    for (const alias of aliases) {
      if (lower[alias] !== undefined && lower[alias] !== '') return lower[alias];
    }
    return '';
  };

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
  const workbook  = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file contains no sheets.');

  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval:    '',
    raw:       true,
    blankrows: false,
  });
};

const parsePdfBuffer = async (buffer) => {
  const data  = await pdfParse(buffer);
  const lines = data.text.split('\n').map((l) => l.trim()).filter(Boolean);

  const rows = [];
  for (const line of lines) {
    const match = line.match(
      /^(\d{4,8})\s{1,10}(.+?)\s{1,10}(Chapter\s+\d+[^0-9]*?)?\s{0,10}(\d{1,2})\s*%?$/i
    );
    if (match) {
      rows.push({
        'HSN Code':        match[1].trim(),
        'Description':     match[2].trim(),
        'Chapter Heading': match[3] ? match[3].trim() : '',
        'GST %':           match[4].trim(),
      });
    }
  }

  if (rows.length === 0) {
    throw new Error(
      'Could not extract HSN rows from the PDF. ' +
      'Ensure the PDF contains tabular data, or use the Excel template.'
    );
  }
  return rows;
};

const upsertHsnRows = async (rows, userId, source = 'manual') => {
  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;
  const errors = [];

  for (const raw of rows) {
    const row = normalizeHsnRow(raw);

    if (!row.hsnCode) {
      errors.push(`Row skipped — missing HSN code: ${JSON.stringify(raw)}`);
      skipped++;
      continue;
    }
    if (!/^\d{4,8}$/.test(row.hsnCode)) {
      errors.push(`Row skipped — invalid HSN code format (4–8 digits required): ${row.hsnCode}`);
      skipped++;
      continue;
    }
    if (row.gstPercentage === null || !VALID_GST_SLABS.includes(row.gstPercentage)) {
      errors.push(
        `Row skipped — invalid GST slab for ${row.hsnCode}: ${row.gstPercentage}. ` +
        `Allowed: ${VALID_GST_SLABS.join(', ')}`
      );
      skipped++;
      continue;
    }
    if (!row.description) {
      errors.push(`Row skipped — missing description for HSN: ${row.hsnCode}`);
      skipped++;
      continue;
    }

    try {
      const existing = await HsnCode.findOne({ hsnCode: row.hsnCode });

      if (existing) {
        existing.description    = row.description    || existing.description;
        existing.chapterHeading = row.chapterHeading || existing.chapterHeading;
        existing.gstPercentage  = row.gstPercentage;
        existing.uploadedBy     = userId;
        existing.uploadSource   = source;
        existing.isActive       = true;
        await existing.save();
        updated++;
      } else {
        await HsnCode.create({
          hsnCode:        row.hsnCode,
          description:    row.description,
          chapterHeading: row.chapterHeading,
          gstPercentage:  row.gstPercentage,
          uploadedBy:     userId,
          uploadSource:   source,
          isActive:       true,
        });
        inserted++;
      }
    } catch (err) {
      if (err.code === 11000) {
        errors.push(`Duplicate key on ${row.hsnCode} — skipped (race condition).`);
      } else {
        errors.push(`Error on ${row.hsnCode}: ${err.message}`);
      }
    }
  }

  return { inserted, updated, skipped, errors };
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — HSN ROUTES
// IMPORTANT: ALL /hsn routes must be declared BEFORE /:slug and /:id routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [H1] GET /api/v1/medicines/hsn
 */
router.get(
  '/hsn',
  cache(120),
  asyncHandler(async (req, res) => {
    const {
      search,
      gst,
      chapter,
      isActive = 'true',
      page     = 1,
      limit    = 20,
      sort     = 'hsnCode',
    } = req.query;

    const query = {};

    if (isActive !== 'all') query.isActive = isActive !== 'false';

    if (gst) {
      const gstNum = parseFloat(gst);
      if (VALID_GST_SLABS.includes(gstNum)) query.gstPercentage = gstNum;
    }

    if (chapter) {
      query.chapterHeading = { $regex: chapter, $options: 'i' };
    }

    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { hsnCode:     { $regex: esc, $options: 'i' } },
        { description: { $regex: esc, $options: 'i' } },
      ];
    }

    const sortMap = {
      hsnCode:      { hsnCode: 1 },
      hsnCode_desc: { hsnCode: -1 },
      gst_asc:      { gstPercentage: 1 },
      gst_desc:     { gstPercentage: -1 },
      newest:       { createdAt: -1 },
    };
    const sortQuery = sortMap[sort] || { hsnCode: 1 };

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const [codes, total] = await Promise.all([
      HsnCode.find(query).sort(sortQuery).skip(skip).limit(limitNum).lean(),
      HsnCode.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      metadata: {
        currentPage: pageNum,
        totalPages:  Math.ceil(total / limitNum),
        pageSize:    limitNum,
      },
      data: codes,
    });
  })
);

/**
 * [H2] GET /api/v1/medicines/hsn/stats
 */
router.get(
  '/hsn/stats',
  protect,
  authorize('superadmin', 'admin'),
  cache(300, () => 'GET:medicines:hsn:stats'),
  asyncHandler(async (req, res) => {
    const stats = await HsnCode.aggregate([
      {
        $facet: {
          gstDistribution: [
            { $group: { _id: '$gstPercentage', count: { $sum: 1 } } },
            { $sort:  { _id: 1 } },
          ],
          sourceBreakdown: [
            { $group: { _id: '$uploadSource', count: { $sum: 1 } } },
          ],
          activeVsInactive: [
            { $group: { _id: '$isActive', count: { $sum: 1 } } },
          ],
          totals: [
            { $group: { _id: null, total: { $sum: 1 } } },
          ],
        },
      },
    ]);

    res.status(200).json({
      success:     true,
      data:        stats[0],
      generatedAt: new Date(),
    });
  })
);

/**
 * [H3] POST /api/v1/medicines/hsn/bulk-delete
 */
router.post(
  '/hsn/bulk-delete',
  protect,
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const { codes } = req.body;

    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide a non-empty array of HSN codes in "codes".',
      });
    }

    const normalized = codes.map((c) =>
      String(c).toUpperCase().replace(/\s/g, '').trim()
    );

    const result = await HsnCode.updateMany(
      { hsnCode: { $in: normalized }, isActive: true },
      { $set: { isActive: false } }
    );

    await invalidateHsnCache();
    auditLog('HSN_BULK_DEACTIVATE', req.user._id, {
      requestedCodes:   normalized,
      deactivatedCount: result.modifiedCount,
    });

    res.status(200).json({
      success:     true,
      message:     `${result.modifiedCount} HSN code(s) deactivated.`,
      matched:     result.matchedCount,
      deactivated: result.modifiedCount,
    });
  })
);

/**
 * [H4] POST /api/v1/medicines/hsn/upload
 */
router.post(
  '/hsn/upload',
  protect,
  authorize('superadmin', 'admin'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Send a multipart/form-data request with field "file".',
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const ext = (originalname.split('.').pop() || '').toLowerCase();

    let imagekitResult;
    try {
      const timestamp    = Date.now();
      const safeBaseName = originalname
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      const fileName = `${safeBaseName}_${timestamp}.${ext}`;
      imagekitResult = await uploadToImageKit(buffer, fileName);
    } catch (uploadErr) {
      console.error('[HSN Upload] ImageKit error:', uploadErr.message);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload file to ImageKit. Please try again.',
        detail:  process.env.NODE_ENV === 'development' ? uploadErr.message : undefined,
      });
    }

    let rows   = [];
    let source;

    const isExcel =
      ['xlsx', 'xls', 'csv'].includes(ext) ||
      mimetype.includes('spreadsheet') ||
      mimetype.includes('excel') ||
      mimetype === 'text/csv';

    const isPdf = ext === 'pdf' || mimetype === 'application/pdf';

    try {
      if (isExcel) {
        rows   = parseExcelBuffer(buffer);
        source = 'excel';
      } else if (isPdf) {
        rows   = await parsePdfBuffer(buffer);
        source = 'pdf';
      } else {
        try {
          rows   = parseExcelBuffer(buffer);
          source = 'excel';
        } catch {
          return res.status(415).json({
            success:     false,
            message:     `Unsupported file type: ${mimetype || ext}. Upload an Excel (.xlsx/.xls/.csv) or PDF.`,
            imagekitUrl: imagekitResult.url,
          });
        }
      }
    } catch (parseErr) {
      return res.status(422).json({
        success:     false,
        message:     `Failed to parse file: ${parseErr.message}`,
        imagekitUrl: imagekitResult.url,
      });
    }

    if (!rows || rows.length === 0) {
      return res.status(422).json({
        success:     false,
        message:     'No data rows found in the file. Check the file format.',
        imagekitUrl: imagekitResult.url,
      });
    }

    const result = await upsertHsnRows(rows, req.user._id, source);

    await invalidateHsnCache();

    auditLog('HSN_BULK_UPLOAD', req.user._id, {
      source,
      file:        originalname,
      size,
      imagekitUrl: imagekitResult.url,
      fileId:      imagekitResult.fileId,
      totalRows:   rows.length,
      inserted:    result.inserted,
      updated:     result.updated,
      skipped:     result.skipped,
    });

    const hasErrors = result.errors.length > 0;

    res.status(hasErrors ? 207 : 200).json({
      success: true,
      message: hasErrors
        ? 'Upload completed with some row-level errors. See "errors" for details.'
        : 'Upload and upsert completed successfully.',
      upload: {
        imagekitUrl:    imagekitResult.url,
        imagekitFileId: imagekitResult.fileId,
        fileName:       imagekitResult.name,
        filePath:       imagekitResult.filePath,
        fileSize:       imagekitResult.size,
        originalName:   originalname,
        source,
      },
      result: {
        totalRows:  rows.length,
        inserted:   result.inserted,
        updated:    result.updated,
        skipped:    result.skipped,
        errorCount: result.errors.length,
        errors:     result.errors.slice(0, 50),
      },
    });
  })
);

/**
 * [H5] GET /api/v1/medicines/hsn/:code
 */
router.get(
  '/hsn/:code',
  cache(300, (req) => `hsn:code:${req.params.code.toUpperCase().trim()}`),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();

    if (!/^\d{4,8}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid HSN code format. Must be 4–8 digits.',
      });
    }

    const hsn = await HsnCode.findOne({ hsnCode: code, isActive: true }).lean();

    if (!hsn) {
      return res.status(404).json({
        success: false,
        message: `HSN code '${code}' not found or is inactive.`,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id:            hsn._id,
        hsnCode:        hsn.hsnCode,
        description:    hsn.description,
        chapterHeading: hsn.chapterHeading,
        gstPercentage:  hsn.gstPercentage,
        cgstPercentage: hsn.cgstPercentage,
        sgstPercentage: hsn.sgstPercentage,
        igstPercentage: hsn.igstPercentage,
        isActive:       hsn.isActive,
      },
    });
  })
);

/**
 * [H6] POST /api/v1/medicines/hsn
 */
router.post(
  '/hsn',
  protect,
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { hsnCode, description, chapterHeading, gstPercentage } = req.body;

    if (!hsnCode || !description || gstPercentage === undefined) {
      return res.status(400).json({
        success: false,
        message: 'hsnCode, description, and gstPercentage are required.',
      });
    }

    const normalizedCode = String(hsnCode).toUpperCase().replace(/\s/g, '').trim();

    if (!/^\d{4,8}$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        message: 'hsnCode must be 4–8 digits.',
      });
    }

    const gstNum = parseFloat(gstPercentage);
    if (!VALID_GST_SLABS.includes(gstNum)) {
      return res.status(400).json({
        success: false,
        message: `Invalid gstPercentage. Allowed values: ${VALID_GST_SLABS.join(', ')}`,
      });
    }

    const existing = await HsnCode.findOne({ hsnCode: normalizedCode });
    if (existing) {
      return res.status(409).json({
        success:    false,
        message:    `HSN code '${normalizedCode}' already exists.`,
        existingId: existing._id,
      });
    }

    const hsn = await HsnCode.create({
      hsnCode:        normalizedCode,
      description:    String(description).trim(),
      chapterHeading: chapterHeading ? String(chapterHeading).trim() : undefined,
      gstPercentage:  gstNum,
      uploadedBy:     req.user._id,
      uploadSource:   'manual',
    });

    await invalidateHsnCache();
    auditLog('HSN_CREATE', req.user._id, { hsnCode: normalizedCode, gstPercentage: gstNum });

    res.status(201).json({ success: true, data: hsn });
  })
);

/**
 * [H7] PATCH /api/v1/medicines/hsn/:code
 */
router.patch(
  '/hsn/:code',
  protect,
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();
    const { description, chapterHeading, gstPercentage, isActive } = req.body;

    const hsn = await HsnCode.findOne({ hsnCode: code });
    if (!hsn) {
      return res.status(404).json({
        success: false,
        message: `HSN code '${code}' not found.`,
      });
    }

    if (description    !== undefined) hsn.description    = String(description).trim();
    if (chapterHeading !== undefined) hsn.chapterHeading = String(chapterHeading).trim();
    if (isActive       !== undefined) hsn.isActive       = Boolean(isActive);

    if (gstPercentage !== undefined) {
      const gstNum = parseFloat(gstPercentage);
      if (!VALID_GST_SLABS.includes(gstNum)) {
        return res.status(400).json({
          success: false,
          message: `Invalid gstPercentage. Allowed: ${VALID_GST_SLABS.join(', ')}`,
        });
      }
      hsn.gstPercentage = gstNum;
    }

    hsn.uploadedBy   = req.user._id;
    hsn.uploadSource = 'manual';
    await hsn.save();

    await invalidateHsnCache();
    auditLog('HSN_UPDATE', req.user._id, { hsnCode: code });

    res.status(200).json({ success: true, data: hsn });
  })
);

/**
 * [H8] DELETE /api/v1/medicines/hsn/:code
 */
router.delete(
  '/hsn/:code',
  protect,
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase().replace(/\s/g, '').trim();

    const hsn = await HsnCode.findOne({ hsnCode: code });
    if (!hsn) {
      return res.status(404).json({
        success: false,
        message: `HSN code '${code}' not found.`,
      });
    }

    if (!hsn.isActive) {
      return res.status(409).json({
        success: false,
        message: `HSN code '${code}' is already inactive.`,
      });
    }

    hsn.isActive = false;
    await hsn.save();

    await invalidateHsnCache();
    auditLog('HSN_DEACTIVATE', req.user._id, { hsnCode: code });

    res.status(200).json({
      success: true,
      message: `HSN code '${code}' has been deactivated.`,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — MEDICINE ROUTES (PUBLIC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [M1] GET /api/v1/medicines
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      search,
      category,
      schedule,
      minPrice,
      maxPrice,
      sort,
      page  = 1,
      limit = 20,
      isPrescriptionRequired,
    } = req.query;

    const query = { isDiscontinued: false };

    if (search) {
      query.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { brandName:   { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) query.category = { $in: category.split(',') };
    if (schedule) query.schedule = { $in: schedule.split(',') };

    if (isPrescriptionRequired !== undefined) {
      query.isPrescriptionRequired = isPrescriptionRequired === 'true';
    }

    if (minPrice || maxPrice) {
      query.mrp = {};
      if (minPrice) query.mrp.$gte = Number(minPrice);
      if (maxPrice && maxPrice !== '1000000') query.mrp.$lte = Number(maxPrice);
    }

    const sortOptions = {
      newest:     { createdAt: -1 },
      price_low:  { mrp: 1 },
      price_high: { mrp: -1 },
      name_asc:   { name: 1 },
    };
    const sortQuery = sortOptions[sort] || { createdAt: -1 };

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Number(limit);
    const skip     = (pageNum - 1) * limitNum;

    const [medicines, count] = await Promise.all([
      Medicine.find(query)
        .populate('inventory.storeId', 'storeName address.city status')
        .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
        .sort(sortQuery)
        .limit(limitNum)
        .skip(skip)
        .lean(),
      Medicine.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count,
      metadata: {
        totalPages:  Math.ceil(count / limitNum),
        currentPage: pageNum,
        pageSize:    limitNum,
      },
      data: medicines,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — MEDICINE ROUTES (PROTECTED)
// ─────────────────────────────────────────────────────────────────────────────

router.use(protect);

/**
 * [M2] GET /api/v1/medicines/admin/stats
 */
router.get(
  '/admin/stats',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    const stats = await Medicine.aggregate([
      {
        $facet: {
          categoryStats: [
            {
              $group: {
                _id:      '$category',
                count:    { $sum: 1 },
                avgPrice: { $avg: '$mrp' },
              },
            },
          ],
          inventoryStats: [
            { $unwind: '$inventory' },
            {
              $group: {
                _id:        null,
                totalStock: { $sum: '$inventory.stockQuantity' },
              },
            },
          ],
          discontinuedCount: [
            { $match: { isDiscontinued: true } },
            { $count: 'count' },
          ],
          lowStockAlerts: [
            { $unwind: '$inventory' },
            { $match: { 'inventory.isLowStock': true } },
            { $count: 'count' },
          ],
          expiryAlerts: [
            { $unwind: '$inventory' },
            {
              $match: {
                'inventory.expiryDate': {
                  $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  $gte: new Date(),
                },
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data:    { summary: stats[0], timestamp: new Date() },
    });
  })
);

/**
 * [M3] POST /api/v1/medicines/restock-request
 */
router.post(
  '/restock-request',
  authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { medicineId, quantityRequired } = req.body;

    if (!medicineId || !quantityRequired) {
      return res.status(400).json({
        success: false,
        message: 'medicineId and quantityRequired are required.',
      });
    }

    const [medicine, admins] = await Promise.all([
      Medicine.findById(medicineId),
      User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id'),
    ]);

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    const notifications = admins.map((adm) => ({
      recipient: adm._id,
      title:     '🔴 URGENT: Restock Required',
      body:      `Pharmacy requested ${quantityRequired} units of ${medicine.brandName}.`,
      type:      'Medicine_Ready',
      priority:  'High',
      metadata:  { medicineId, quantityRequired, requestedBy: req.user._id },
    }));

    await Notification.insertMany(notifications);

    auditLog('RESTOCK_REQUEST', req.user._id, { medicineId, quantityRequired });

    res.status(200).json({
      success: true,
      message: 'Restock request logged and admins notified.',
    });
  })
);

/**
 * [M4] GET /api/v1/medicines/:slug
 */
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findOne({
      slug:           req.params.slug,
      isDiscontinued: false,
    })
      .populate({
        path:   'inventory.storeId',
        select: 'storeName contact address status priority',
      })
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .lean();

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    res.status(200).json({ success: true, data: medicine });
  })
);

/**
 * [M5] POST /api/v1/medicines
 * FIX: syncInventoryAllStores now correctly returns a number again.
 * The pharmacy-role branch uses addStoreInventory for its specific store,
 * then syncInventoryAllStores fills in the remaining stores (with 0 stock).
 */
router.post(
  '/',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const medicineData     = { ...req.body };
      medicineData.createdBy = req.user._id;

      if (medicineData.hsnCode) {
        medicineData.hsnCode = await resolveHsnCodeId(medicineData.hsnCode, session);
      }

      if (medicineData.brandName) {
        medicineData.slug = `${slugify(medicineData.brandName, { lower: true })}-${Date.now()}`;
      }

      medicineData.inventory = [];

      // ── Pharmacy: seed their own store with real stock data ──────────────
      if (req.user.role === 'pharmacy') {
        const profile = await PharmacyProfile
          .findOne({ user: req.user._id })
          .populate('assignedStore')
          .session(session);

        if (!profile?.assignedStore) {
          throw new Error('Pharmacist must be assigned to a store before adding products.');
        }

        medicineData.inventory.push({
          storeId:          profile.assignedStore._id,
          addedBy:          req.user._id,
          updatedBy:        req.user._id,
          stockQuantity:    req.body.initialStock  || 0,
          reservedQuantity: 0,
          reorderLevel:     10,
          expiryDate:       req.body.expiryDate    || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          batchNumber:      req.body.batchNumber   || 'INIT-BATCH',
          pricePerUnit:     req.body.pricePerUnit  || req.body.mrp,
          isLowStock:       (req.body.initialStock || 0) <= 10,
          isExpired:        false,
          isActive:         true,
        });

      // ── Admin/SuperAdmin: seed a specific store if storeId provided ──────
      } else if (req.body.storeId) {
        const store = await PharmacyStore.findById(req.body.storeId).session(session);
        if (!store) throw new Error(`Store '${req.body.storeId}' not found.`);

        medicineData.inventory.push({
          storeId:          store._id,
          addedBy:          req.user._id,
          updatedBy:        req.user._id,
          stockQuantity:    req.body.initialStock  || 0,
          reservedQuantity: 0,
          reorderLevel:     10,
          expiryDate:       req.body.expiryDate    || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          batchNumber:      req.body.batchNumber   || 'INIT-BATCH',
          pricePerUnit:     req.body.pricePerUnit  || req.body.mrp,
          isLowStock:       (req.body.initialStock || 0) <= 10,
          isExpired:        false,
          isActive:         true,
        });
      }

      ['storeId', 'initialStock', 'expiryDate', 'batchNumber', 'pricePerUnit'].forEach(
        (f) => delete medicineData[f]
      );

      const [medicine] = await Medicine.create([medicineData], { session });

      // ── Bulk-sync: fill ALL remaining stores with zero-stock placeholders ─
      // This is what populates inventory[] for every store automatically.
      const syncAdded = await syncInventoryAllStores(medicine, req.user._id, session);
      if (syncAdded > 0) {
        await medicine.save({ session });
      }

      await session.commitTransaction();

      const populated = await Medicine.findById(medicine._id)
        .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
        .populate('inventory.storeId', 'storeName address.city status')
        .lean();

      auditLog('MEDICINE_CREATE', req.user._id, {
        medicineId:        medicine._id,
        inventoryAutoSync: syncAdded,
      });

      res.status(201).json({ success: true, data: populated });

    } catch (error) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: error.message });
    } finally {
      session.endSession();
    }
  })
);

/**
 * [M6] PATCH /api/v1/medicines/:id
 * FIX: syncInventoryAllStores call at the bottom now correctly returns
 * a number and the check `syncAdded > 0` works properly.
 */
router.patch(
  '/:id',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    // ── Pharmacy: own-store inventory only ───────────────────────────────────
    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id });
      if (!profile?.assignedStore) {
        return res.status(403).json({
          success: false,
          message: 'No store assigned to this account.',
        });
      }

      const { stockQuantity, expiryDate, batchNumber, pricePerUnit } = req.body;
      const targetStoreId = profile.assignedStore.toString();
      const stockIndex = medicine.inventory.findIndex(
        (item) => item.storeId.toString() === targetStoreId
      );

      if (stockIndex > -1) {
        if (stockQuantity !== undefined) {
          medicine.inventory[stockIndex].stockQuantity = stockQuantity;
          medicine.inventory[stockIndex].isLowStock =
            stockQuantity <= (medicine.inventory[stockIndex].reorderLevel ?? 10);
        }
        if (expiryDate)   medicine.inventory[stockIndex].expiryDate   = expiryDate;
        if (batchNumber)  medicine.inventory[stockIndex].batchNumber  = batchNumber;
        if (pricePerUnit) medicine.inventory[stockIndex].pricePerUnit = pricePerUnit;
        medicine.inventory[stockIndex].updatedBy = req.user._id;
      } else {
        medicine.inventory.push({
          storeId:          profile.assignedStore,
          addedBy:          req.user._id,
          updatedBy:        req.user._id,
          stockQuantity:    stockQuantity    || 0,
          reservedQuantity: 0,
          reorderLevel:     10,
          expiryDate:       expiryDate       || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          batchNumber:      batchNumber      || 'INIT-BATCH',
          pricePerUnit:     pricePerUnit     || medicine.mrp,
          isLowStock:       (stockQuantity   || 0) <= 10,
          isExpired:        false,
          isActive:         true,
        });
      }

      medicine.updatedBy = req.user._id;
      await medicine.save();

      auditLog('MEDICINE_INVENTORY_UPDATE_PHARMACY', req.user._id, {
        medicineId: medicine._id,
        storeId:    targetStoreId,
      });

      const populated = await Medicine.findById(medicine._id)
        .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
        .populate('inventory.storeId', 'storeName address.city status')
        .lean();

      return res.status(200).json({ success: true, data: populated });
    }

    // ── Admin / SuperAdmin ───────────────────────────────────────────────────
    const {
      storeId,
      initialStock,
      expiryDate,
      batchNumber,
      pricePerUnit,
      ...coreFields
    } = req.body;

    if (coreFields.hsnCode) {
      coreFields.hsnCode = await resolveHsnCodeId(coreFields.hsnCode);
    }

    Object.assign(medicine, coreFields, { updatedBy: req.user._id });

    if (storeId) {
      const store = await PharmacyStore.findById(storeId);
      if (!store) {
        return res.status(404).json({ success: false, message: `Store '${storeId}' not found.` });
      }

      const stockIndex = medicine.inventory.findIndex(
        (item) => item.storeId.toString() === storeId.toString()
      );

      if (stockIndex > -1) {
        if (initialStock !== undefined) {
          medicine.inventory[stockIndex].stockQuantity = initialStock;
          medicine.inventory[stockIndex].isLowStock =
            initialStock <= (medicine.inventory[stockIndex].reorderLevel ?? 10);
        }
        if (expiryDate)   medicine.inventory[stockIndex].expiryDate   = expiryDate;
        if (batchNumber)  medicine.inventory[stockIndex].batchNumber  = batchNumber;
        if (pricePerUnit) medicine.inventory[stockIndex].pricePerUnit = pricePerUnit;
        medicine.inventory[stockIndex].updatedBy = req.user._id;
      } else {
        medicine.inventory.push({
          storeId,
          addedBy:          req.user._id,
          updatedBy:        req.user._id,
          stockQuantity:    initialStock  || 0,
          reservedQuantity: 0,
          reorderLevel:     10,
          expiryDate:       expiryDate    || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          batchNumber:      batchNumber   || 'INIT-BATCH',
          pricePerUnit:     pricePerUnit  || medicine.mrp,
          isLowStock:       (initialStock || 0) <= 10,
          isExpired:        false,
          isActive:         true,
        });
      }
    }

    await medicine.save();

    // ── Fill any stores added since this medicine was last saved ─────────────
    const syncAdded = await syncInventoryAllStores(medicine, req.user._id);
    if (syncAdded > 0) {
      medicine.updatedBy = req.user._id;
      await medicine.save();
    }

    auditLog('MEDICINE_METADATA_UPDATE', req.user._id, {
      medicineId:        medicine._id,
      inventoryAutoSync: syncAdded,
    });

    const populated = await Medicine.findById(medicine._id)
      .populate('hsnCode', 'hsnCode description gstPercentage cgstPercentage sgstPercentage igstPercentage')
      .populate('inventory.storeId', 'storeName address.city status')
      .lean();

    res.status(200).json({ success: true, data: populated });
  })
);

/**
 * [M7] PATCH /api/v1/medicines/:id/update-stock
 */
router.patch(
  '/:id/update-stock',
  authorize('pharmacy', 'admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const { quantity, expiryDate, batchNumber, pricePerUnit } = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        success: false,
        message: 'quantity is required.',
      });
    }

    let targetStoreId;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id });
      if (!profile || !profile.assignedStore) {
        return res.status(403).json({
          success: false,
          message: 'No store assigned to this account.',
        });
      }
      targetStoreId = profile.assignedStore;
    } else {
      targetStoreId = req.body.storeId;
      if (!targetStoreId) {
        return res.status(400).json({
          success: false,
          message: 'storeId is required for admin/superadmin.',
        });
      }
      const store = await PharmacyStore.findById(targetStoreId);
      if (!store) {
        return res.status(404).json({
          success: false,
          message: `Store '${targetStoreId}' not found.`,
        });
      }
    }

    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    const stockIndex = medicine.inventory.findIndex(
      (item) => item.storeId.toString() === targetStoreId.toString()
    );

    if (stockIndex > -1) {
      medicine.inventory[stockIndex].stockQuantity = quantity;
      medicine.inventory[stockIndex].isLowStock    =
        quantity <= (medicine.inventory[stockIndex].reorderLevel ?? 10);
      if (expiryDate)   medicine.inventory[stockIndex].expiryDate   = expiryDate;
      if (batchNumber)  medicine.inventory[stockIndex].batchNumber  = batchNumber;
      if (pricePerUnit) medicine.inventory[stockIndex].pricePerUnit = pricePerUnit;
      medicine.inventory[stockIndex].updatedBy = req.user._id;
    } else {
      medicine.inventory.push({
        storeId:          targetStoreId,
        addedBy:          req.user._id,
        stockQuantity:    quantity,
        reservedQuantity: 0,
        reorderLevel:     10,
        expiryDate:       expiryDate   || new Date(),
        batchNumber,
        pricePerUnit:     pricePerUnit || medicine.mrp,
        isLowStock:       quantity     <= 10,
        isActive:         true,
      });
    }

    await medicine.save();

    auditLog('STOCK_LEVEL_ADJUSTMENT', req.user._id, {
      medicineId:  medicine._id,
      storeId:     targetStoreId,
      newQuantity: quantity,
    });

    res.status(200).json({ success: true, data: medicine.inventory });
  })
);

/**
 * [M8] DELETE /api/v1/medicines/:id
 */
router.delete(
  '/:id',
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    medicine.isDiscontinued = true;
    await medicine.save();

    const pharmacies = await User.find({ role: 'pharmacy' }).select('email');
    const emailPromises = pharmacies.map((p) =>
      sendEmail({
        email:   p.email,
        subject: `[COMPLIANCE] ${medicine.brandName} Withdrawn`,
        html:    transactionalTemplate({
          header:     'PRODUCT RECALL / DISCONTINUATION',
          title:      'Urgent Action Required',
          body:       `The product <b>${medicine.brandName}</b> (${medicine.genericName}) has been marked as discontinued. Please remove it from your active shelves immediately.`,
          buttonText: 'View Inventory',
          buttonLink: getDashboardLink('pharmacy', '/inventory'),
        }),
      })
    );

    await Promise.allSettled(emailPromises);

    auditLog('MEDICINE_DISCONTINUE', req.user._id, { medicineId: medicine._id });

    res.status(200).json({
      success: true,
      message: 'Medicine discontinued and pharmacies notified.',
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9b — MANUAL SYNC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [M9] POST /api/v1/medicines/sync-inventory/all
 * No change needed in route logic — was already correct.
 * Just ensure syncInventoryAllStores returns a number (fixed above).
 */
router.post(
  '/sync-inventory/all',
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const medicines = await Medicine.find({ isDiscontinued: false });

    let totalAdded      = 0;
    let medicinesSynced = 0;
    const errors        = [];

    for (const medicine of medicines) {
      try {
        const added = await syncInventoryAllStores(medicine, req.user._id);
        if (added > 0) {
          medicine.updatedBy = req.user._id;
          await medicine.save();
          totalAdded      += added;
          medicinesSynced += 1;
        }
      } catch (err) {
        errors.push({ medicineId: medicine._id.toString(), error: err.message });
      }
    }

    auditLog('MEDICINE_INVENTORY_BULK_SYNC', req.user._id, {
      totalMedicines: medicines.length,
      medicinesSynced,
      totalAdded,
      errors:         errors.length,
    });

    res.status(errors.length > 0 ? 207 : 200).json({
      success:           true,
      totalMedicines:    medicines.length,
      medicinesSynced,
      totalEntriesAdded: totalAdded,
      errors,
    });
  })
);

/**
 * [M10] POST /api/v1/medicines/:id/sync-inventory
 * Same fix — syncInventoryAllStores returns a number.
 */
router.post(
  '/:id/sync-inventory',
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    const addedCount = await syncInventoryAllStores(medicine, req.user._id);

    if (addedCount > 0) {
      medicine.updatedBy = req.user._id;
      await medicine.save();
    }

    auditLog('MEDICINE_INVENTORY_SYNC', req.user._id, {
      medicineId: medicine._id,
      addedCount,
    });

    res.status(200).json({
      success:               true,
      message:               addedCount > 0
        ? `Synced ${addedCount} new store(s) with zero-stock placeholders.`
        : 'All stores already have inventory entries. Nothing to sync.',
      addedCount,
      totalInventoryEntries: medicine.inventory.length,
    });
  })
);

/**
 * [M10] POST /api/v1/medicines/:id/sync-inventory
 */
router.post(
  '/:id/sync-inventory',
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    const addedCount = await syncInventoryAllStores(medicine, req.user._id);

    if (addedCount > 0) {
      medicine.updatedBy = req.user._id;
      await medicine.save();
    }

    auditLog('MEDICINE_INVENTORY_SYNC', req.user._id, {
      medicineId: medicine._id,
      addedCount,
    });

    res.status(200).json({
      success:               true,
      message:               addedCount > 0
        ? `Synced ${addedCount} new store(s) with zero stock.`
        : 'All stores already have inventory entries. Nothing to sync.',
      addedCount,
      totalInventoryEntries: medicine.inventory.length,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9c — STORE LIFECYCLE ROUTES
// These handle PharmacyStore deletion and suspension/unsuspension and auto-sync
// medicine inventory accordingly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [SL1] DELETE /api/v1/medicines/stores/:storeId
 *
 * Permanently deletes a PharmacyStore and:
 *  1. Hard-removes every inventory entry for this store across ALL medicines.
 *  2. Notifies admins.
 *
 * Access: superadmin only
 */
router.delete(
  '/stores/:storeId',
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const { storeId } = req.params;

    const store = await PharmacyStore.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    // 1. Hard-delete inventory entries across all medicines
    const medicinesUpdated = await removeStoreFromAllMedicines(storeId, req.user._id);

    // 2. Delete the store
    await PharmacyStore.findByIdAndDelete(storeId);

    // 3. Notify admins
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
    const notifications = admins.map((a) => ({
      recipient: a._id,
      title:     `🗑️ Store Deleted — ${store.storeName}`,
      body:      `Store "${store.storeName}" has been permanently deleted. Inventory entries removed from ${medicinesUpdated} medicine(s).`,
      type:      'Medicine_Ready',
      priority:  'High',
      metadata:  { storeId, storeName: store.storeName, medicinesUpdated },
    }));
    await Notification.insertMany(notifications);

    auditLog('STORE_DELETED', req.user._id, {
      storeId,
      storeName:        store.storeName,
      medicinesUpdated,
    });

    res.status(200).json({
      success: true,
      message: `Store "${store.storeName}" deleted. Inventory purged from ${medicinesUpdated} medicine(s).`,
      medicinesUpdated,
    });
  })
);

/**
 * [SL2] PATCH /api/v1/medicines/stores/:storeId/suspend
 *
 * Suspends a PharmacyStore (status → 'Under-Maintenance') and:
 *  1. Sets isActive = false on ALL inventory entries for this store across every medicine.
 *  2. Sends in-app notifications to admins.
 *  3. Sends email to the store's pharmacist manager.
 *
 * Access: superadmin, admin
 */
router.patch(
  '/stores/:storeId/suspend',
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const { reason } = req.body;

    const store = await PharmacyStore.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    if (store.status === 'Inactive') {
      return res.status(409).json({
        success: false,
        message: `Store "${store.storeName}" is already permanently inactive.`,
      });
    }

    if (store.status === 'Under-Maintenance') {
      return res.status(409).json({
        success: false,
        message: `Store "${store.storeName}" is already suspended.`,
      });
    }

    // 1. Update store status
    store.status    = 'Under-Maintenance';
    store.updatedBy = req.user._id;
    await store.save();

    // 2. Pause inventory across all medicines
    const medicinesUpdated = await suspendStoreInventory(storeId, req.user._id);

    // 3. In-app notifications for admins
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
    const notifications = admins.map((a) => ({
      recipient: a._id,
      title:     `⏸️ Store Suspended — ${store.storeName}`,
      body:      `Store "${store.storeName}" has been suspended. ${medicinesUpdated} medicine inventory entries paused.${reason ? ` Reason: ${reason}` : ''}`,
      type:      'Medicine_Ready',
      priority:  'High',
      metadata:  { storeId, storeName: store.storeName, reason, medicinesUpdated },
    }));
    await Notification.insertMany(notifications);

    // 4. Email pharmacist manager
    const pharmacyProfile = await PharmacyProfile
      .findOne({ assignedStore: storeId })
      .populate('user', 'email name')
      .lean();

    if (pharmacyProfile?.user?.email) {
      await sendEmail({
        email:   pharmacyProfile.user.email,
        subject: `[STORE SUSPENDED] ${store.storeName} — Action Required`,
        html:    transactionalTemplate({
          header:     'STORE SUSPENSION NOTICE',
          title:      `Your store "${store.storeName}" has been suspended`,
          body:       `Your store has been placed under maintenance and is temporarily suspended.
                       All medicine inventory for this store has been paused and will not be visible to customers.
                       ${reason ? `<br><br><strong>Reason:</strong> ${reason}` : ''}
                       <br><br>Please contact your administrator for further details.`,
          buttonText: 'Contact Support',
          buttonLink: getDashboardLink('pharmacy', '/support'),
        }),
      }).catch((err) => console.error('[SuspendEmail] Failed:', err.message));
    }

    auditLog('STORE_SUSPENDED', req.user._id, {
      storeId,
      storeName:        store.storeName,
      reason,
      medicinesUpdated,
    });

    res.status(200).json({
      success: true,
      message: `Store "${store.storeName}" suspended. ${medicinesUpdated} medicine inventory entries paused.`,
      medicinesUpdated,
    });
  })
);

/**
 * [SL3] PATCH /api/v1/medicines/stores/:storeId/unsuspend
 *
 * Unsuspends / re-opens a PharmacyStore and:
 *  1. Restores isActive = true on all inventory entries for this store.
 *  2. Immediately fires low-stock notifications + emails for any medicines
 *     that are still at or below LOW_STOCK_THRESHOLD.
 *  3. Notifies admins and the pharmacist.
 *
 * Access: superadmin, admin
 */
router.patch(
  '/stores/:storeId/unsuspend',
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { storeId } = req.params;

    const store = await PharmacyStore.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    if (store.status === 'Open') {
      return res.status(409).json({
        success: false,
        message: `Store "${store.storeName}" is already open.`,
      });
    }

    if (store.status === 'Inactive') {
      return res.status(409).json({
        success: false,
        message: `Store "${store.storeName}" is permanently inactive and cannot be unsuspended.`,
      });
    }

    // 1. Update store status
    store.status    = 'Open';
    store.updatedBy = req.user._id;
    await store.save();

    // 2. Resume inventory + fire low-stock alerts immediately
    const medicinesUpdated = await resumeStoreInventory(storeId, store, req.user._id);

    // 3. In-app notifications for admins and pharmacist
    const [admins, pharmacyProfile] = await Promise.all([
      User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id'),
      PharmacyProfile.findOne({ assignedStore: storeId }).populate('user', '_id email name').lean(),
    ]);

    const recipientIds = admins.map((a) => a._id);
    if (pharmacyProfile?.user?._id) recipientIds.push(pharmacyProfile.user._id);

    const notifications = recipientIds.map((recipientId) => ({
      recipient: recipientId,
      title:     `✅ Store Reopened — ${store.storeName}`,
      body:      `Store "${store.storeName}" has been unsuspended. ${medicinesUpdated} medicine inventory entries restored. Check low-stock alerts.`,
      type:      'Medicine_Ready',
      priority:  'High',
      metadata:  { storeId, storeName: store.storeName, medicinesUpdated },
    }));
    await Notification.insertMany(notifications);

    // 4. Email pharmacist manager
    if (pharmacyProfile?.user?.email) {
      await sendEmail({
        email:   pharmacyProfile.user.email,
        subject: `[STORE REOPENED] ${store.storeName} is back online`,
        html:    transactionalTemplate({
          header:     'STORE REOPENED',
          title:      `Your store "${store.storeName}" is now active`,
          body:       `Your store has been successfully unsuspended and is now accepting orders.
                       All medicine inventory has been restored.
                       <br><br><strong>Note:</strong> Please review your inventory — some medicines may be low on stock and require immediate restocking.`,
          buttonText: 'View Inventory',
          buttonLink: getDashboardLink('pharmacy', '/inventory'),
        }),
      }).catch((err) => console.error('[UnsuspendEmail] Failed:', err.message));
    }

    auditLog('STORE_UNSUSPENDED', req.user._id, {
      storeId,
      storeName:        store.storeName,
      medicinesUpdated,
    });

    res.status(200).json({
      success: true,
      message: `Store "${store.storeName}" is now open. ${medicinesUpdated} medicine inventory entries restored. Low-stock alerts fired.`,
      medicinesUpdated,
    });
  })
);

/**
 * [SL4] POST /api/v1/medicines/stores/low-stock/trigger
 *
 * Manually triggers the low-stock email + notification run for ALL open
 * stores immediately (equivalent to what the daily cron does).
 *
 * Access: superadmin
 */
router.post(
  '/stores/low-stock/trigger',
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    const { storeId } = req.body;

    if (storeId) {
      // Single store
      const store = await PharmacyStore.findById(storeId).lean();
      if (!store) {
        return res.status(404).json({ success: false, message: 'Store not found.' });
      }

      await triggerLowStockAlertsForStore(storeId, store, req.user._id);

      auditLog('LOW_STOCK_MANUAL_TRIGGER', req.user._id, { storeId });

      return res.status(200).json({
        success: true,
        message: `Low-stock alerts triggered for store "${store.storeName}".`,
      });
    }

    // All stores
    await sendDailyLowStockEmails();

    auditLog('LOW_STOCK_MANUAL_TRIGGER_ALL', req.user._id, {});

    res.status(200).json({
      success: true,
      message: 'Low-stock alerts triggered for all open stores.',
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY ROUTES
// All under /api/v1/medicines/:id/inventory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [INV1] GET /api/v1/medicines/:id/inventory
 */
router.get(
  '/:id/inventory',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id)
      .populate('inventory.storeId', 'storeName address.city status priority')
      .lean();

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    let inventory = medicine.inventory;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore) {
        return res.status(403).json({ success: false, message: 'No store assigned to this account.' });
      }
      inventory = inventory.filter(
        (inv) => inv.storeId?._id?.toString() === profile.assignedStore.toString()
      );
    }

    res.status(200).json({
      success: true,
      count:   inventory.length,
      data:    inventory,
    });
  })
);

/**
 * [INV2] GET /api/v1/medicines/:id/inventory/:storeId
 */
router.get(
  '/:id/inventory/:storeId',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore) {
        return res.status(403).json({ success: false, message: 'No store assigned to this account.' });
      }
      if (profile.assignedStore.toString() !== req.params.storeId) {
        return res.status(403).json({ success: false, message: "Access denied to this store's inventory." });
      }
    }

    const medicine = await Medicine.findById(req.params.id)
      .populate('inventory.storeId', 'storeName address.city status')
      .lean();

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    const entry = medicine.inventory.find(
      (inv) =>
        inv.storeId?._id?.toString() === req.params.storeId ||
        inv.storeId?.toString()      === req.params.storeId
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: `No inventory entry found for store '${req.params.storeId}'.`,
      });
    }

    res.status(200).json({ success: true, data: entry });
  })
);

/**
 * [INV3] POST /api/v1/medicines/:id/inventory
 */
router.post(
  '/:id/inventory',
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { storeId, stockQuantity, expiryDate, batchNumber, pricePerUnit, location, reorderLevel } = req.body;

    if (!storeId || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'storeId and expiryDate are required.',
      });
    }

    const [medicine, store] = await Promise.all([
      Medicine.findById(req.params.id),
      PharmacyStore.findById(storeId),
    ]);

    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });
    if (!store)    return res.status(404).json({ success: false, message: `Store '${storeId}' not found.` });

    const alreadyExists = medicine.inventory.some(
      (inv) => inv.storeId.toString() === storeId.toString()
    );
    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: `Inventory entry for store '${storeId}' already exists. Use PATCH /:id/inventory/:storeId to update it.`,
      });
    }

    medicine.inventory.push({
      storeId,
      addedBy:          req.user._id,
      stockQuantity:    stockQuantity  ?? 0,
      reservedQuantity: 0,
      reorderLevel:     reorderLevel   ?? 10,
      expiryDate,
      batchNumber:      batchNumber    || 'INIT-BATCH',
      pricePerUnit:     pricePerUnit   || medicine.mrp,
      location:         location       || '',
      isLowStock:       (stockQuantity ?? 0) <= (reorderLevel ?? 10),
      isActive:         true,
    });

    medicine.updatedBy = req.user._id;
    await medicine.save();

    auditLog('INVENTORY_ENTRY_ADD', req.user._id, {
      medicineId: medicine._id,
      storeId,
      stockQuantity,
    });

    const added = medicine.inventory.find((inv) => inv.storeId.toString() === storeId.toString());
    res.status(201).json({ success: true, data: added });
  })
);

/**
 * [INV4] PATCH /api/v1/medicines/:id/inventory/:storeId
 */
router.patch(
  '/:id/inventory/:storeId',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    const { storeId } = req.params;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore) {
        return res.status(403).json({ success: false, message: 'No store assigned to this account.' });
      }
      if (profile.assignedStore.toString() !== storeId) {
        return res.status(403).json({ success: false, message: "You can only update your own store's inventory." });
      }
    }

    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    const stockIndex = medicine.inventory.findIndex(
      (inv) => inv.storeId.toString() === storeId
    );
    if (stockIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `No inventory entry for store '${storeId}'. Use POST /:id/inventory to create one.`,
      });
    }

    const inv = medicine.inventory[stockIndex];
    const {
      stockQuantity,
      reservedQuantity,
      reorderLevel,
      expiryDate,
      manufacturingDate,
      batchNumber,
      pricePerUnit,
      location,
      isActive,
    } = req.body;

    if (stockQuantity     !== undefined) inv.stockQuantity     = stockQuantity;
    if (reservedQuantity  !== undefined) inv.reservedQuantity  = reservedQuantity;
    if (reorderLevel      !== undefined) inv.reorderLevel      = reorderLevel;
    if (expiryDate        !== undefined) inv.expiryDate        = expiryDate;
    if (manufacturingDate !== undefined) inv.manufacturingDate = manufacturingDate;
    if (batchNumber       !== undefined) inv.batchNumber       = batchNumber;
    if (pricePerUnit      !== undefined) inv.pricePerUnit      = pricePerUnit;
    if (location          !== undefined) inv.location          = location;
    if (isActive          !== undefined) inv.isActive          = isActive;

    inv.isLowStock = inv.stockQuantity <= inv.reorderLevel;
    inv.isExpired  = inv.expiryDate ? inv.expiryDate < new Date() : false;
    inv.updatedBy  = req.user._id;

    medicine.updatedBy = req.user._id;
    await medicine.save();

    // If stock was replenished above threshold, no need for alert.
    // If still low, the daily cron will catch it — no on-demand spam here.

    auditLog('INVENTORY_ENTRY_UPDATE', req.user._id, {
      medicineId: medicine._id,
      storeId,
      changes:    req.body,
    });

    res.status(200).json({ success: true, data: medicine.inventory[stockIndex] });
  })
);

/**
 * [INV5] DELETE /api/v1/medicines/:id/inventory/:storeId
 */
router.delete(
  '/:id/inventory/:storeId',
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { storeId }  = req.params;
    const hardDelete   = req.query.hard === 'true' && req.user.role === 'superadmin';

    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found.' });

    const stockIndex = medicine.inventory.findIndex(
      (inv) => inv.storeId.toString() === storeId
    );
    if (stockIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `No inventory entry for store '${storeId}'.`,
      });
    }

    if (hardDelete) {
      medicine.inventory.splice(stockIndex, 1);
      auditLog('INVENTORY_ENTRY_HARD_DELETE', req.user._id, { medicineId: medicine._id, storeId });
    } else {
      medicine.inventory[stockIndex].isActive  = false;
      medicine.inventory[stockIndex].updatedBy = req.user._id;
      auditLog('INVENTORY_ENTRY_SOFT_DELETE', req.user._id, { medicineId: medicine._id, storeId });
    }

    medicine.updatedBy = req.user._id;
    await medicine.save();

    res.status(200).json({
      success: true,
      message: hardDelete
        ? `Inventory entry for store '${storeId}' permanently removed.`
        : `Inventory entry for store '${storeId}' deactivated.`,
    });
  })
);

/**
 * [INV6] GET /api/v1/medicines/inventory/low-stock
 */
router.get(
  '/inventory/low-stock',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    const { storeId, page = 1, limit = 20 } = req.query;

    let filterStoreId = storeId;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore) {
        return res.status(403).json({ success: false, message: 'No store assigned to this account.' });
      }
      filterStoreId = profile.assignedStore.toString();
    }

    const matchStage = {
      'inventory.isLowStock': true,
      'inventory.isActive':   true,
      isDiscontinued:         false,
    };
    if (filterStoreId) matchStage['inventory.storeId'] = new mongoose.Types.ObjectId(filterStoreId);

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [results, totalDocs] = await Promise.all([
      Medicine.aggregate([
        { $unwind: '$inventory' },
        { $match: matchStage },
        {
          $project: {
            name:        1,
            brandName:   1,
            genericName: 1,
            mrp:         1,
            images:      1,
            packaging:   1,
            inventory:   1,
          },
        },
        { $sort:  { 'inventory.stockQuantity': 1 } },
        { $skip:  (pageNum - 1) * limitNum },
        { $limit: limitNum },
      ]),
      Medicine.aggregate([
        { $unwind: '$inventory' },
        { $match:  matchStage },
        { $count:  'total' },
      ]),
    ]);

    const total = totalDocs[0]?.total ?? 0;

    res.status(200).json({
      success: true,
      total,
      metadata: {
        currentPage: pageNum,
        totalPages:  Math.ceil(total / limitNum),
        pageSize:    limitNum,
      },
      data: results,
    });
  })
);

/**
 * [INV7] GET /api/v1/medicines/inventory/expiry-alerts
 */
router.get(
  '/inventory/expiry-alerts',
  authorize('superadmin', 'admin', 'pharmacy'),
  asyncHandler(async (req, res) => {
    const { days = 30, storeId, page = 1, limit = 20 } = req.query;
    const daysNum = Math.max(1, parseInt(days, 10));

    let filterStoreId = storeId;

    if (req.user.role === 'pharmacy') {
      const profile = await PharmacyProfile.findOne({ user: req.user._id }).lean();
      if (!profile?.assignedStore) {
        return res.status(403).json({ success: false, message: 'No store assigned to this account.' });
      }
      filterStoreId = profile.assignedStore.toString();
    }

    const now       = new Date();
    const threshold = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);

    const matchStage = {
      'inventory.isActive':   true,
      'inventory.expiryDate': { $gte: now, $lte: threshold },
      isDiscontinued:         false,
    };
    if (filterStoreId) matchStage['inventory.storeId'] = new mongoose.Types.ObjectId(filterStoreId);

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [results, totalDocs] = await Promise.all([
      Medicine.aggregate([
        { $unwind: '$inventory' },
        { $match:  matchStage },
        {
          $project: {
            name:      1,
            brandName: 1,
            mrp:       1,
            images:    1,
            inventory: 1,
          },
        },
        { $sort:  { 'inventory.expiryDate': 1 } },
        { $skip:  (pageNum - 1) * limitNum },
        { $limit: limitNum },
      ]),
      Medicine.aggregate([
        { $unwind: '$inventory' },
        { $match:  matchStage },
        { $count:  'total' },
      ]),
    ]);

    const total = totalDocs[0]?.total ?? 0;

    res.status(200).json({
      success: true,
      total,
      withinDays: daysNum,
      metadata: {
        currentPage: pageNum,
        totalPages:  Math.ceil(total / limitNum),
        pageSize:    limitNum,
      },
      data: results,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY STORE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [S1] GET /api/v1/stores
 */
router.get('/stores', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, storeType, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = {};
  if (status)    query.status    = status;
  if (storeType) query.storeType = storeType;
  if (search)    query.storeName = { $regex: search, $options: 'i' };

  const [stores, total] = await Promise.all([
    PharmacyStore.find(query)
      .populate('managedBy', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    PharmacyStore.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    pagination: {
      total,
      page:  parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
    data: stores,
  });
}));

/**
 * [S2] GET /api/v1/stores/nearby
 */
router.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const { lat, lng, radiusKm = 5, limit = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng query params are required.',
      });
    }

    const stores = await PharmacyStore.find({
      status:     'Open',
      isVerified: true,
      'address.coordinates': {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radiusKm) * 1000,
        },
      },
    })
      .select('storeName address contact deliverySettings status specializations timings slug')
      .limit(Math.min(50, parseInt(limit, 10)))
      .lean();

    res.status(200).json({ success: true, count: stores.length, data: stores });
  })
);

/**
 * [S3] GET /api/v1/stores/:id
 */
router.get(
  '/:id',
  protect,
  asyncHandler(async (req, res) => {
    const query = PharmacyStore.findById(req.params.id)
      .populate('managedBy', 'name email phone');

    if (!['admin', 'superadmin'].includes(req.user.role)) {
      query.select('-bankDetails');
    }

    const store = await query.lean();
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    res.status(200).json({ success: true, data: store });
  })
);

/**
 * [S4] GET /api/v1/stores/slug/:slug
 */
router.get(
  '/slug/:slug',
  asyncHandler(async (req, res) => {
    const store = await PharmacyStore.findOne({ slug: req.params.slug })
      .select('-bankDetails')
      .populate('managedBy', 'name email')
      .lean();

    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    res.status(200).json({ success: true, data: store });
  })
);

/**
 * [S5] GET /api/v1/stores/my/store
 */
router.get(
  '/my/store',
  protect,
  authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const profile = await PharmacyProfile.findOne({ user: req.user._id })
      .populate({
        path:   'assignedStore',
        select: '-bankDetails',
      })
      .lean();

    if (!profile?.assignedStore) {
      return res.status(404).json({
        success: false,
        message: 'No store assigned to your account.',
      });
    }

    res.status(200).json({ success: true, data: profile.assignedStore });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — CENTRALIZED ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  console.error(
    `[MEDICINE_ROUTER_ERROR] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );
  console.error(err.stack || err.message);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error:   'Validation Error',
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error:   'Duplicate Entry',
      message: `A record with this ${field} already exists.`,
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error:   'Invalid ID Format',
      message: err.message,
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error:   'File Too Large',
      message: `File size must not exceed ${MAX_FILE_SIZE_MB} MB.`,
    });
  }

  if (err.isAxiosError) {
    return res.status(502).json({
      success: false,
      error:   'Upstream Service Error',
      message: 'ImageKit upload service returned an error.',
      detail:  process.env.NODE_ENV === 'development'
        ? err.response?.data || err.message
        : undefined,
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error:   'Authentication Error',
      message: err.message,
    });
  }

  res.status(err.status || 500).json({
    success:   false,
    error:     err.message || 'Internal Server Error',
    errorCode: err.code    || 'MEDICINE_ROUTER_FAIL',
  });
});

export default router;