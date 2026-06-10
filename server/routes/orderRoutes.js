import express        from 'express';
import mongoose       from 'mongoose';
import Razorpay       from 'razorpay';
import crypto         from 'crypto';
import jwt            from 'jsonwebtoken';
import ImageKit       from 'imagekit';
import multer         from 'multer';
import { protect }    from '../middleware/authMiddleware.js';

// ── Models ────────────────────────────────────────────────────────────────────
import Medicine        from '../models/Medicine.js';
import Cart            from '../models/Cart.js';
import PharmacyOrder   from '../models/PharmacyOrder.js';
import PharmacyStore   from '../models/PharmacyStore.js';
import UserSubscription from '../models/UserSubscription.js';
import Wallet          from '../models/Wallet.js';
import Notification    from '../models/Notification.js';
import User            from '../models/User.js';
import PromotionCoupon from '../models/PromotionCoupon.js';
import SystemLog       from '../models/SystemLog.js';

// ── Utilities ─────────────────────────────────────────────────────────────────
import sendEmail from '../utils/sendEmail.js';
import {
  buildOrderEmailHtml,
  buildStatusUpdateEmail,
  buildRefundEmail,
  transactionalTemplate,
} from '../utils/emailTemplates.js';
import { generateInvoice } from '../utils/invoiceGenerator.js';
import cache from '../middleware/cache.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// § CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || 'rzp_test_SJTh9WQJSGGnIT';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '0IT2SC59bGq578K2QnUEleFX';

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPEG, PNG, WEBP, and PDF files are allowed for prescriptions.'));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// § LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

const logAudit = (action, meta = {}) =>
  console.log(`[AUDIT][${new Date().toISOString()}] ${action}`, meta);

const logError = (action, err, ctx = {}) =>
  console.error(`[ERROR][${new Date().toISOString()}] ${action}: ${err.message}`, { stack: err.stack, ctx });

const syslog = async (level, category, message, opts = {}) => {
  try {
    await SystemLog.createLog({ level, category, message, ...opts });
  } catch (err) {
    console.error('[syslog] Failed:', err.message);
  }
};

const actorFromReq = (req) => ({
  userId:    req.user?._id    ?? null,
  name:      req.user?.name   ?? 'anonymous',
  email:     req.user?.email  ?? null,
  role:      req.user?.role   ?? 'anonymous',
  ip:        req.ip           ?? 'unknown',
  userAgent: req.headers['user-agent'] ?? null,
  platform:  'web',
});

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logError('ASYNC_HANDLER', err, { userId: req.user?._id });
    logError('ASYNC_HANDLER', err, { path: req.originalUrl });
    next(err);
  });

// ═══════════════════════════════════════════════════════════════════════════════
// § OTP GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ═══════════════════════════════════════════════════════════════════════════════
// § OPTIONAL JWT USER
// ═══════════════════════════════════════════════════════════════════════════════

const getOptionalUserId = async (req) => {
  try {
    if (!req.headers.authorization?.startsWith('Bearer')) return null;
    const token   = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    return decoded.id;
  } catch { return null; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SAFE ORDER LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

const findOrderSafe = async (identifier, extraFilter = {}, session = null) => {
  if (!identifier) return null;
  const str = String(identifier).trim();
  const orConditions = [{ orderId: str }];
  if (mongoose.Types.ObjectId.isValid(str))
    orConditions.push({ _id: new mongoose.Types.ObjectId(str) });
  const query = PharmacyOrder.findOne({ $or: orConditions, ...extraFilter });
  if (session) query.session(session);
  try { return await query; }
  catch (err) { logError('FIND_ORDER_SAFE', err, { identifier }); return null; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § NOTIFICATION + EMAIL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

const dispatchNotification = async (userId, payload, orderData = null, storeName = null, emailOverrideHtml = null) => {
  try {
    const { title, body, type, emailSubject, actionLink, headerNote = '' } = payload;
    await Notification.create({
      recipient: userId, title, body, type, priority: 'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: orderData?._id },
    });
    const user = await User.findById(userId).select('email name').lean();
    if (!user?.email) return;
    let html;
    if (emailOverrideHtml) {
      html = emailOverrideHtml;
    } else if (orderData) {
      html = buildOrderEmailHtml({
        userName: user.name, order: orderData, orderItems: orderData.items || [],
        billing: orderData.billing, storeName, actionLink: actionLink || 'https://likeson.in/dashboard', headerNote,
      });
    } else {
      html = transactionalTemplate({
        header: 'LIKESON HEALTHCARE', title: emailSubject || title,
        body: payload.emailBody || body, buttonText: 'View Details',
        buttonLink: actionLink || 'https://likeson.in/dashboard', userName: user.name,
      });
    }
    await sendEmail({ email: user.email, subject: `[Likeson Healthcare] ${emailSubject || title}`, html });
  } catch (err) {
    logError('NOTIFICATION_DISPATCH', err, { userId });
  }
};

const dispatchStatusUpdateEmail = async (order, newStatus, storeName = null) => {
  try {
    const user = await User.findById(order.customer).select('email name').lean();
    if (!user?.email) return;
    const html = buildStatusUpdateEmail({
      userName: user.name, order, orderItems: order.items || [], billing: order.billing,
      storeName, actionLink: `https://likeson.in/pharmacy/orders/${order._id}`, newStatus,
    });
    await sendEmail({ email: user.email, subject: `[Likeson Healthcare] Order #${order.orderId} — Status Updated`, html });
    await Notification.create({
      recipient: order.customer, title: 'Order Status Updated',
      body: `Your order #${order.orderId} is now: ${newStatus}`,
      type: 'Order_Update', priority: 'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id },
    });
  } catch (err) {
    logError('STATUS_UPDATE_EMAIL', err, { orderId: order.orderId });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § ORDER CONFIRMATION EMAIL WITH MEDICINE IMAGES
// ═══════════════════════════════════════════════════════════════════════════════

const dispatchOrderConfirmationEmail = async (userId, order, storeName, headerNote = '') => {
  try {
    const user = await User.findById(userId).select('email name').lean();
    if (!user?.email) return;

    const enrichedItems = await Promise.all(
      (order.items || []).map(async (item) => {
        if (item.medicineImage) return item;
        try {
          const med = await Medicine.findById(item.medicine).select('images brandName genericName').lean();
          return { ...item, medicineImage: med?.images?.[0]?.url || null };
        } catch { return item; }
      })
    );

    const html = buildOrderEmailHtml({
      userName:    user.name,
      order,
      orderItems:  enrichedItems,
      billing:     order.billing,
      storeName,
      actionLink:  `https://likeson.in/pharmacy/orders/${order._id}`,
      headerNote,
      statusLabel: 'Order Placed Successfully!',
      statusIcon:  '✅',
      statusColor: '#15803d',
      statusBg:    '#f0fdf4',
      statusBorder:'#bbf7d0',
    });

    await sendEmail({
      email:   user.email,
      subject: `[Likeson Healthcare] Order Confirmed — #${order.orderId}`,
      html,
    });

    await Notification.create({
      recipient:  userId,
      title:      'Order Placed Successfully',
      body:       `Your order #${order.orderId} has been confirmed. Check your email for details.`,
      type:       'Order_Placed',
      priority:   'High',
      actionData: { screen: 'ORDER_DETAIL_SCREEN', referenceId: order._id },
    });
  } catch (err) {
    logError('ORDER_CONFIRMATION_EMAIL', err, { userId, orderId: order?.orderId });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// § IMAGEKIT UPLOAD HELPER
// ═══════════════════════════════════════════════════════════════════════════════

const uploadToImageKit = async (buffer, fileName, folder = '/prescriptions') => {
  const timestamp  = Date.now();
  const safeName   = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${timestamp}_${safeName}`;
  const response   = await imagekit.upload({
    file: buffer.toString('base64'), fileName: uniqueName,
    folder, useUniqueFileName: true, tags: ['prescription', 'pharmacy'],
  });
  return response.url;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const resolvePharmacyDiscount = async (userId) => {
  if (!userId) return 0;
  try {
    const sub = await UserSubscription.findOne({
      user: userId,
      status: { $in: ['Active', 'Trial'] },
    })
      .select('limits.pharmacyDiscountPercent')
      .lean();
    return sub?.limits?.pharmacyDiscountPercent ?? 0;
  } catch { return 0; }
};

const toObjectId = (value, label = 'id') => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (value && typeof value === 'object' && value._id) {
    const inner = value._id;
    if (mongoose.Types.ObjectId.isValid(inner)) return new mongoose.Types.ObjectId(inner.toString());
  }
  if (value && typeof value === 'object' && value.$oid)
    return new mongoose.Types.ObjectId(value.$oid);
  const str = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (mongoose.Types.ObjectId.isValid(str)) return new mongoose.Types.ObjectId(str);
  throw new Error(`Invalid ${label}: "${str}" is not a valid ObjectId.`);
};

const extractStoreId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value._id)  return value._id.toString();
  if (typeof value === 'object' && value.$oid)  return value.$oid.toString();
  return value.toString();
};

const validatePhoneNumber = (phone) => /^[0-9]{10}$/.test(phone.replace(/[^\d]/g, ''));
const validatePincode     = (pincode) => /^[0-9]{6}$/.test(pincode);

const validateDeliveryAddress = (address) => {
  const required = ['fullName', 'line1', 'pincode', 'phone'];
  const missing  = required.filter((f) => !address[f]);
  if (missing.length) throw new Error(`Missing required address fields: ${missing.join(', ')}`);
  if (!validatePhoneNumber(address.phone)) throw new Error('Invalid phone number format');
  if (!validatePincode(address.pincode))   throw new Error('Invalid pincode format');
};

const validateAndApplyCoupon = async (code, userId, orderTotal, session = null) => {
  if (!code || typeof code !== 'string') throw new Error('Coupon code is required.');
  const query = PromotionCoupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (session) query.session(session);
  const coupon = await query.lean();
  if (!coupon) throw new Error(`Coupon "${code}" is invalid or deactivated.`);
  const now = new Date();
  if (coupon.validity?.from && now < coupon.validity.from) throw new Error(`Coupon "${code}" is not yet active.`);
  if (coupon.validity?.to   && now > coupon.validity.to)   throw new Error(`Coupon "${code}" has expired.`);
  if (coupon.usage?.totalPlatformLimit != null && coupon.usage.currentUses >= coupon.usage.totalPlatformLimit)
    throw new Error(`Coupon "${code}" has reached its usage limit.`);
  const userUseCount = await PharmacyOrder.countDocuments({
    customer: userId, 'billing.promoCode': code.toUpperCase(), 'payment.status': { $in: ['Paid', 'Pending'] },
  }).session(session);
  if (userUseCount >= (coupon.usage?.limitPerUser ?? 1))
    throw new Error(`You have already used coupon "${code}" the maximum number of times.`);
  if (coupon.eligibility?.minOrderValue && orderTotal < coupon.eligibility.minOrderValue)
    throw new Error(`Minimum order value ₹${coupon.eligibility.minOrderValue} required.`);
  if (coupon.eligibility?.type === 'New_User_Only') {
    const any = await PharmacyOrder.exists({ customer: userId }).session(session);
    if (any) throw new Error(`Coupon "${code}" is only for new users.`);
  }
  if (coupon.eligibility?.type === 'First_Booking') {
    const prior = await PharmacyOrder.exists({ customer: userId, 'payment.status': 'Paid' }).session(session);
    if (prior) throw new Error(`Coupon "${code}" is only valid on your first order.`);
  }
  let discountAmount = 0;
  if (coupon.benefit?.type === 'Percentage') {
    discountAmount = parseFloat(((orderTotal * coupon.benefit.value) / 100).toFixed(2));
    if (coupon.benefit?.maxCap) discountAmount = Math.min(discountAmount, coupon.benefit.maxCap);
  } else if (coupon.benefit?.type === 'Flat_Amount') {
    discountAmount = Math.min(coupon.benefit.value, orderTotal);
  }
  return { coupon, discountAmount: parseFloat(discountAmount.toFixed(2)) };
};

const commitCouponUsage = async (couponId, session = null) => {
  const q = PromotionCoupon.findByIdAndUpdate(couponId, { $inc: { 'usage.currentUses': 1 } }, { new: true });
  if (session) q.session(session);
  return await q;
};

// ── Prescription helpers ──────────────────────────────────────────────────────

const cartHasPrescriptionItems = (items) =>
  items.some((i) => i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true);

const getMissingPrescriptionItems = (items) =>
  items.filter(
    (i) =>
      (i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true) &&
      !i.prescription?.imageUrl,
  );

const buildOrderPrescription = (cartItems) => {
  const requiresRx = cartItems.some(
    (i) => i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true,
  );
  if (!requiresRx) return { isRequired: false };
  const rxItem = cartItems.find(
    (i) =>
      (i.isPrescriptionRequired === true || i.medicine?.isPrescriptionRequired === true) &&
      i.prescription?.imageUrl,
  );
  return {
    isRequired: true, imageUrl: rxItem?.prescription?.imageUrl ?? null,
    uploadedAt: rxItem?.prescription?.uploadedAt ?? null, isVerified: false,
    verificationStatus: rxItem?.prescription?.imageUrl ? 'Pending' : 'Not_Uploaded',
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HAVERSINE DISTANCE
// ═══════════════════════════════════════════════════════════════════════════════

const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDistanceKm = (store, customerCoords) => {
  const sc = store.address?.coordinates;
  if (!sc || sc.lat == null || sc.lng == null) return null;
  if (
    !Array.isArray(customerCoords) ||
    customerCoords.length < 2 ||
    (customerCoords[0] === 0 && customerCoords[1] === 0)
  ) return null;
  // customerCoords = [lng, lat] from GeoJSON Point
  return haversineKm(customerCoords, [sc.lng, sc.lat]);
};

// ═══════════════════════════════════════════════════════════════════════════════
// § CORRECTED MULTI-STORE CART FULFILMENT
// ═══════════════════════════════════════════════════════════════════════════════
//
// ALGORITHM:
//  1. Fetch all medicines from cart in a single DB call.
//  2. Collect every unique storeId that has at least one non-expired,
//     active inventory entry with qty > 0 across ALL cart medicines.
//     (No radius filtering — every open+verified store is eligible.)
//  3. Fetch all those PharmacyStore docs in a single DB call.
//  4. Sort stores by distance from customer (nulls last) — closest first.
//  5. For each cart item try to assign it to the CLOSEST store that has
//     enough stock. If the closest store is already being used for other
//     items from this cart, prefer that same store (consolidation) as long
//     as it has enough stock, to minimise number of orders.
//  6. If no single store can fulfil a particular item, mark it unavailable.
//  7. Return groups (one per store) and unavailableItems list.
//
// ═══════════════════════════════════════════════════════════════════════════════

const resolveMultiStoreForCart = async (cartItems, customerUser) => {
  const now            = new Date();
  const customerCoords = customerUser?.location?.coordinates; // [lng, lat]

  // ── Step 1: fetch all medicine documents ──────────────────────────────────
  const medicineIds = cartItems.map((item) =>
    (item.medicine?._id ?? item.medicine).toString()
  );
  const medicines = await Medicine.find({ _id: { $in: medicineIds } }).lean();
  const medMap    = new Map(medicines.map((m) => [m._id.toString(), m]));

  // ── Step 2: collect all candidate store IDs ───────────────────────────────
  const allStoreIds = new Set();
  for (const med of medicines) {
    for (const inv of (med.inventory || [])) {
      if (
        inv.isActive &&
        !inv.isExpired &&
        inv.expiryDate > now &&
        inv.stockQuantity > 0
      ) {
        allStoreIds.add(inv.storeId.toString());
      }
    }
  }

  // ── Step 3: fetch all open + verified stores (no radius limit) ────────────
  let openStores = [];
  if (allStoreIds.size > 0) {
    openStores = await PharmacyStore.find({
      _id:        { $in: Array.from(allStoreIds) },
      status:     'Open',
      isVerified: true,
    }).lean();
  }

  // ── Step 4: sort stores by distance, closest first ────────────────────────
  const storesSortedByDistance = openStores
    .map((store) => ({
      store,
      distanceKm: getDistanceKm(store, customerCoords),
    }))
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return  1;
      return 0;
    });

  const storeMap = new Map(openStores.map((s) => [s._id.toString(), s]));

  // ── Helper: get a store's inventory entry for a medicine ──────────────────
  const getInvEntry = (medicine, storeIdStr) =>
    (medicine.inventory || []).find(
      (inv) =>
        inv.storeId.toString() === storeIdStr &&
        inv.isActive &&
        !inv.isExpired &&
        inv.expiryDate > now &&
        inv.stockQuantity > 0
    ) ?? null;

  // ── Step 5 & 6: assign each cart item to the best store ──────────────────
  //
  // "reservedQty" tracks how much stock we've already promised to this order
  // from each (medicine, store) pair, so we don't over-commit.
  // key = `${medicineId}:${storeIdStr}`, value = qty already reserved
  const reservedQty = new Map();

  const storeGroups      = new Map(); // storeIdStr → { storeDoc, items[] }
  const unavailableItems = [];

  for (const cartItem of cartItems) {
    const medId    = (cartItem.medicine?._id ?? cartItem.medicine).toString();
    const medicine = medMap.get(medId);
    const qty      = parseInt(cartItem.quantity, 10);
    const name     = medicine?.brandName ?? medicine?.genericName ?? 'Medicine';

    // ── Basic guards ────────────────────────────────────────────────────────
    if (!qty || isNaN(qty) || qty <= 0) {
      unavailableItems.push({ medicineId: medId, name, reason: `Invalid quantity: ${cartItem.quantity}` });
      continue;
    }
    if (!medicine || medicine.isDiscontinued) {
      unavailableItems.push({ medicineId: medId, name, reason: 'discontinued' });
      continue;
    }

    // ── Find the best store for this item ───────────────────────────────────
    //
    // Priority order:
    //   a) A store already assigned for this cart (consolidation) that has
    //      enough REMAINING stock (after our own reservations).
    //   b) The closest open store that has enough remaining stock.
    //
    let assignedStoreIdStr = null;
    let assignedInvEntry   = null;
    let assignedDistanceKm = null;

    // Pass A: try to consolidate with an already-chosen store
    for (const [existingStoreIdStr] of storeGroups) {
      const inv = getInvEntry(medicine, existingStoreIdStr);
      if (!inv) continue;
      const reserveKey  = `${medId}:${existingStoreIdStr}`;
      const alreadyUsed = reservedQty.get(reserveKey) ?? 0;
      if (inv.stockQuantity - alreadyUsed >= qty) {
        assignedStoreIdStr = existingStoreIdStr;
        assignedInvEntry   = inv;
        assignedDistanceKm = getDistanceKm(storeMap.get(existingStoreIdStr), customerCoords);
        break;
      }
    }

    // Pass B: if no consolidation found, pick the closest store with enough stock
    if (!assignedStoreIdStr) {
      for (const { store, distanceKm } of storesSortedByDistance) {
        const storeIdStr = store._id.toString();
        const inv        = getInvEntry(medicine, storeIdStr);
        if (!inv) continue;
        const reserveKey  = `${medId}:${storeIdStr}`;
        const alreadyUsed = reservedQty.get(reserveKey) ?? 0;
        if (inv.stockQuantity - alreadyUsed >= qty) {
          assignedStoreIdStr = storeIdStr;
          assignedInvEntry   = inv;
          assignedDistanceKm = distanceKm;
          break;
        }
      }
    }

    if (!assignedStoreIdStr) {
      // No store could satisfy the required quantity
      const totalAvailable = (medicine.inventory || []).reduce(
        (sum, inv) => sum + (inv.stockQuantity || 0), 0
      );
      unavailableItems.push({
        medicineId: medId,
        name,
        reason: totalAvailable === 0
          ? 'Out of stock at all stores'
          : `Insufficient stock (need ${qty}; combined available: ${totalAvailable})`,
      });
      continue;
    }

    // ── Reserve the qty in our local tracker ────────────────────────────────
    const reserveKey = `${medId}:${assignedStoreIdStr}`;
    reservedQty.set(reserveKey, (reservedQty.get(reserveKey) ?? 0) + qty);

    // ── Add to store group ──────────────────────────────────────────────────
    if (!storeGroups.has(assignedStoreIdStr)) {
      storeGroups.set(assignedStoreIdStr, {
        storeDoc: storeMap.get(assignedStoreIdStr),
        items:    [],
      });
    }

    storeGroups.get(assignedStoreIdStr).items.push({
      medicine,                  // full lean medicine doc
      quantity:               qty,
      pricePerUnit:           cartItem.pricePerUnit ?? null,
      gstPercentage:          cartItem.gstPercentage ?? medicine.gstPercentage ?? 0,
      isPrescriptionRequired: cartItem.isPrescriptionRequired ?? medicine.isPrescriptionRequired ?? false,
      prescription:           cartItem.prescription ?? null,
      _resolvedInv:           assignedInvEntry,
      _distanceKm:            assignedDistanceKm,
    });
  }

  return {
    groups:           Array.from(storeGroups.values()),
    unavailableItems,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SINGLE-MEDICINE STORE RESOLUTION  (used by /cart/add and /order/direct)
// ═══════════════════════════════════════════════════════════════════════════════

const resolveStoreForMedicine = async (medicineId, requiredQty, customerUser, preferredStoreId = null) => {
  const medicine = await Medicine.findById(medicineId).lean();
  if (!medicine)               throw new Error('Medicine not found.');
  if (medicine.isDiscontinued) throw new Error(`"${medicine.brandName}" is discontinued.`);
  if (!medicine.inventory?.length)
    throw new Error(`"${medicine.brandName}" is not stocked at any store.`);

  const now = new Date();

  const eligibleEntries = medicine.inventory.filter((inv) =>
    inv.isActive &&
    !inv.isExpired &&
    inv.expiryDate > now &&
    inv.stockQuantity >= requiredQty
  );

  if (!eligibleEntries.length) {
    const totalAvailable = medicine.inventory.reduce((s, i) => s + (i.stockQuantity || 0), 0);

    if (totalAvailable === 0)
      throw new Error(`"${medicine.brandName}" is out of stock across all stores.`);

    // Check if all active entries are expired
    const activeNonExpiredEntries = medicine.inventory.filter(
      (inv) => inv.isActive && !inv.isExpired && inv.expiryDate > now
    );

    if (activeNonExpiredEntries.length === 0)
      throw new Error(
        `"${medicine.brandName}" is currently unavailable — all stock has expired or is inactive.`
      );

    // Stock exists and is valid, but not enough quantity
    const maxAvailable = Math.max(...activeNonExpiredEntries.map((i) => i.stockQuantity));
    throw new Error(
      `"${medicine.brandName}" does not have sufficient stock (requested: ${requiredQty}). ` +
      `Maximum available at any single store: ${maxAvailable}.`
    );
  }

  const eligibleStoreIds = eligibleEntries.map((e) => e.storeId);
  const stores = await PharmacyStore.find({
    _id:        { $in: eligibleStoreIds },
    status:     'Open',
    isVerified: true,
  }).lean();

  if (!stores.length)
    throw new Error(
      `"${medicine.brandName}" is currently unavailable — all stocking stores are closed or unverified.`
    );

  const customerCoords = customerUser?.location?.coordinates;

  const candidates = stores.map((store) => {
    const invEntry   = eligibleEntries.find((e) =>
      new mongoose.Types.ObjectId(e.storeId).equals(store._id)
    );
    const distanceKm = getDistanceKm(store, customerCoords);
    return { store, inventoryEntry: invEntry, distanceKm };
  });

 candidates.sort((a, b) => {
  if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm; // nearest first
  if (a.distanceKm !== null) return -1;
  if (b.distanceKm !== null) return  1;
  return (b.inventoryEntry.stockQuantity || 0) - (a.inventoryEntry.stockQuantity || 0); // fallback: most stock
});

  if (preferredStoreId) {
    const prefObjId = toObjectId(preferredStoreId, 'preferredStoreId');
    const prefCand  = candidates.find((c) => c.store._id.equals(prefObjId));
    if (prefCand) {
      return {
        store:          prefCand.store,
        inventoryEntry: prefCand.inventoryEntry,
        medicine,
        distanceKm:     prefCand.distanceKm,
      };
    }
  }

  const best = candidates[0];
  return {
    store:          best.store,
    inventoryEntry: best.inventoryEntry,
    medicine,
    distanceKm:     best.distanceKm,
  };
};
// ═══════════════════════════════════════════════════════════════════════════════
// § STOCK HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Decrement stock for each item at the given store, within a session.
 * Uses a positional $ update so only the matching inventory sub-document
 * is touched. Throws on concurrent-stock conflict.
 */
const decrementStock = async (items, storeId, session) => {
  const storeObjId = toObjectId(storeId, 'storeId');

  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    if (!qty || isNaN(qty) || qty <= 0) {
      throw new Error(
        `Cannot decrement stock for "${item.name ?? item.medicine}": quantity is invalid (${item.quantity}).`
      );
    }

    // Atomic: find the medicine whose inventory entry for this store
    // still has enough stock, then decrement exactly that entry.
   const updated = await Medicine.findOneAndUpdate(
  {
    _id: item.medicine,
    inventory: {
      $elemMatch: {
        storeId:       storeObjId,
        isActive:      true,
        isExpired:     false,
        expiryDate:    { $gt: new Date() },
        stockQuantity: { $gte: qty },
      },
    },
  },
      { $inc: { 'inventory.$.stockQuantity': -qty } },
      { new: true, session }
    );

    if (!updated) {
  const med = await Medicine.findById(item.medicine).session(session);
  const now = new Date();
  const totalAvailable = (med?.inventory ?? [])
    .filter(
      (inv) =>
        new mongoose.Types.ObjectId(inv.storeId).equals(storeObjId) &&
        inv.isActive &&
        !inv.isExpired &&
        inv.expiryDate > now
    )
    .reduce((sum, inv) => sum + (inv.stockQuantity || 0), 0);

  if (totalAvailable === 0) {
    throw new Error(`"${item.name}" is not stocked at the selected store.`);
  }
  throw new Error(
    `Concurrent stock conflict for "${item.name}". ` +
    `Available: ${totalAvailable}, requested: ${qty}. Please retry.`
  );
}

    // Flag low-stock if needed
    const afterInv = updated.inventory.find((i) =>
      new mongoose.Types.ObjectId(i.storeId).equals(storeObjId)
    );
    if (afterInv && afterInv.stockQuantity <= (afterInv.reorderLevel ?? 10)) {
      await Medicine.findOneAndUpdate(
        {
          _id:       item.medicine,
          inventory: { $elemMatch: { storeId: storeObjId, stockQuantity: afterInv.stockQuantity } },
        },
        { $set: { 'inventory.$.isLowStock': true } },
        { session }
      );
    }
  }
};

const incrementStock = async (items, storeId, session) => {
  const storeObjId = toObjectId(storeId, 'storeId');
  for (const item of items) {
    const qty = parseInt(item.quantity, 10);
    const updated = await Medicine.findOneAndUpdate(
      { _id: item.medicine, inventory: { $elemMatch: { storeId: storeObjId } } },
      { $inc: { 'inventory.$.stockQuantity': qty } },
      { new: true, session }
    );
    if (updated) {
      const inv = updated.inventory.find((i) =>
        new mongoose.Types.ObjectId(i.storeId).equals(storeObjId)
      );
      if (inv && inv.stockQuantity > inv.reorderLevel) {
        await Medicine.findOneAndUpdate(
          { _id: item.medicine, inventory: { $elemMatch: { storeId: storeObjId } } },
          { $set: { 'inventory.$.isLowStock': false } },
          { session }
        );
      }
    }
  }
};

const clearCart = async (userId, session = null) => {
  const q = Cart.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        items:       [],
        store:       null,
        billSummary: { itemsTotal: 0, estimatedTax: 0, totalAmount: 0 },
      },
    },
    { new: true }
  );
  if (session) q.session(session);
  return await q;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § ROUTES — CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 0. POST /api/pharmacy/upload/prescription
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/upload/prescription',
  protect,
  upload.single('prescription'),
  asyncHandler(async (req, res) => {
    let imageUrl;

    if (req.file) {
      try {
        imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/prescriptions');
      } catch (err) {
        logError('IMAGEKIT_UPLOAD', err, { userId: req.user._id });
        await syslog('error', 'api', 'Prescription upload to ImageKit failed', {
          actor:   actorFromReq(req),
          request: { method: 'POST', path: req.originalUrl, statusCode: 500 },
          metadata: { fileName: req.file.originalname },
        });
        return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
      }

      logAudit('PRESCRIPTION_UPLOAD_IMAGEKIT', { userId: req.user._id, fileName: req.file.originalname, imageUrl });
      await syslog('success', 'api', 'Customer uploaded prescription (file)', {
        actor:   actorFromReq(req),
        request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
        metadata: { fileName: req.file.originalname, size: req.file.size, imageUrl },
      });

      return res.status(200).json({
        success: true, message: 'Prescription uploaded successfully.',
        imageUrl, fileName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype,
      });
    }

    const { base64, fileName = 'prescription.jpg', mimeType = 'image/jpeg' } = req.body;

    if (base64) {
      if (typeof base64 !== 'string' || !base64.trim())
        return res.status(400).json({ success: false, message: 'base64 string is required when not using multipart upload.' });

      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      try {
        const response = await imagekit.upload({
          file: cleanBase64,
          fileName: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
          folder: '/prescriptions', useUniqueFileName: true, tags: ['prescription', 'pharmacy'],
        });
        imageUrl = response.url;
      } catch (err) {
        logError('IMAGEKIT_BASE64_UPLOAD', err, { userId: req.user._id });
        return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
      }

      return res.status(200).json({ success: true, message: 'Prescription uploaded successfully.', imageUrl, fileName, mimeType });
    }

    return res.status(400).json({
      success: false,
      message: 'No file provided. Send a multipart file with field "prescription" or a JSON body with { base64, fileName }.',
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 0a. GET /api/pharmacy/upload/auth
// ─────────────────────────────────────────────────────────────────────────────

router.get('/upload/auth', protect, asyncHandler(async (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    return res.status(200).json({
      success: true, ...authParams,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  } catch (err) {
    logError('IMAGEKIT_AUTH_PARAMS', err, { userId: req.user._id });
    return res.status(500).json({ success: false, message: 'Failed to generate upload authentication.' });
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/pharmacy/medicines
// ─────────────────────────────────────────────────────────────────────────────

router.get('/medicines', cache(120), asyncHandler(async (req, res) => {
  const { search, category, storeId, page = 1, limit = 12, sort = 'createdAt_desc' } = req.query;
  const filter = { isDiscontinued: false };
  if (search)   filter.$text = { $search: search };
  if (category) filter.category = { $in: category.split(',') };
  if (storeId)  filter['inventory.storeId'] = toObjectId(storeId, 'storeId');
  const sortMap  = { mrp_asc: { mrp: 1 }, mrp_desc: { mrp: -1 }, createdAt_desc: { createdAt: -1 } };
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;
  const [medicines, total] = await Promise.all([
    Medicine.find(filter)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip).limit(limitNum)
      .populate('inventory.storeId', 'storeName address status')
      .lean(),
    Medicine.countDocuments(filter),
  ]);
  res.status(200).json({
    success: true,
    pagination: { total, pages: Math.ceil(total / limitNum), page: pageNum, limit: limitNum },
    medicines,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/pharmacy/cart
// ─────────────────────────────────────────────────────────────────────────────

router.get('/cart', protect, asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id })
    .populate('items.medicine', 'brandName genericName images gstPercentage isPrescriptionRequired')
    .populate('store', 'storeName address contact deliverySettings status')
    .lean();

  const result = cart || { items: [], billSummary: { itemsTotal: 0, estimatedTax: 0, totalAmount: 0 } };

  if (result.items?.length) {
    result.prescriptionSummary = {
      hasRxItems:     cartHasPrescriptionItems(result.items),
      missingUploads: getMissingPrescriptionItems(result.items).map((i) => ({
        medicineId: i.medicine?._id || i.medicine,
        name:       i.medicine?.brandName || 'Medicine',
      })),
    };
  }
  res.status(200).json({ success: true, cart: result });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/pharmacy/cart/add
//
// NOTE: The cart model does NOT have a storeId per item — it is store-agnostic.
// Store resolution happens at checkout time. We only validate that the medicine
// exists and has stock somewhere, and persist the item with pricePerUnit from
// the best-matched store's inventory (or mrp as fallback).
// ─────────────────────────────────────────────────────────────────────────────

router.post('/cart/add', asyncHandler(async (req, res) => {
  const { medicineId, quantity = 1, prescription } = req.body;
  const preferredStoreId = extractStoreId(req.body.storeId) || null;

  if (!medicineId)
    return res.status(400).json({ success: false, message: 'medicineId is required.' });

  const quantityNum = Math.max(1, parseInt(quantity, 10));
  const userId      = await getOptionalUserId(req);

  const customerUser = userId
    ? await User.findById(userId).select('location').lean()
    : null;

  // Resolve the best store to verify availability and get a price
  let resolvedStore, inventoryEntry, medicine;
  try {
    ({ store: resolvedStore, inventoryEntry, medicine } = await resolveStoreForMedicine(
      medicineId, quantityNum, customerUser, preferredStoreId
    ));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const resolvedStoreIdStr = resolvedStore._id.toString();
  const storeOverridden    = preferredStoreId && preferredStoreId !== resolvedStoreIdStr;

  if (!userId) {
    return res.status(200).json({
      success: true, isGuest: true,
      item: {
        medicine:               medicineId,
        quantity:               quantityNum,
        pricePerUnit:           inventoryEntry.pricePerUnit ?? medicine.mrp,
        isPrescriptionRequired: medicine.isPrescriptionRequired ?? false,
      },
      ...(storeOverridden && {
        notice: `Your preferred store did not have sufficient stock. Item would be sourced from "${resolvedStore.storeName}" instead.`,
      }),
    });
  }

  // Upsert the cart document
  let cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const pricePerUnit     = inventoryEntry.pricePerUnit ?? medicine.mrp;
  const prescriptionData = {
    isRequired: medicine.isPrescriptionRequired ?? false,
    imageUrl:   prescription?.imageUrl  || null,
    uploadedAt: prescription?.imageUrl  ? new Date() : null,
  };

  // Check if the same medicine is already in the cart
  const itemIdx = cart.items.findIndex(
    (i) => i.medicine.toString() === medicineId.toString()
  );

  if (itemIdx > -1) {
    const newQty = cart.items[itemIdx].quantity + quantityNum;
    // Validate against the stock of the best available store
    if (newQty > inventoryEntry.stockQuantity) {
      return res.status(400).json({
        success:        false,
        message:        `Total quantity (${newQty}) exceeds available stock (${inventoryEntry.stockQuantity}).`,
        availableStock: inventoryEntry.stockQuantity,
      });
    }
    cart.items[itemIdx].quantity = newQty;
    if (prescription?.imageUrl) cart.items[itemIdx].prescription = prescriptionData;
  } else {
    cart.items.push({
      medicine:               toObjectId(medicineId, 'medicineId'),
      quantity:               quantityNum,
      pricePerUnit,
      gstPercentage:          medicine.gstPercentage ?? 12,
      isPrescriptionRequired: medicine.isPrescriptionRequired ?? false,
      prescription:           prescriptionData,
    });
  }

  // The cart.store field is kept as a "hint" (last resolved store) but is NOT
  // the source of truth for checkout — resolveMultiStoreForCart decides that.
  cart.store = resolvedStore._id;
  await cart.save();
  await cart.populate('items.medicine', 'brandName genericName images dosage packaging isPrescriptionRequired');
  await cart.populate('store', 'storeName address status');

  logAudit('CART_ADD', { userId, medicineId, quantity: quantityNum, hintStore: resolvedStoreIdStr, storeOverridden });
  await syslog('info', 'api', 'Customer added item to cart', {
    actor:    { userId, role: 'customer' },
    request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
    metadata: { medicineId, quantity: quantityNum, hintStoreId: resolvedStoreIdStr, storeOverridden },
  });

  res.status(200).json({
    success: true,
    cart:    cart.toObject(),
    ...(storeOverridden && {
      notice: `Your preferred store did not have sufficient stock. Item sourced from "${resolvedStore.storeName}" instead.`,
    }),
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/pharmacy/cart/update
// ─────────────────────────────────────────────────────────────────────────────

router.post('/cart/update', protect, asyncHandler(async (req, res) => {
  const { medicineId, quantity } = req.body;
  if (!medicineId || quantity === undefined)
    return res.status(400).json({ success: false, message: 'medicineId and quantity are required.' });

  const quantityNum = parseInt(quantity, 10);
  if (quantityNum < 0)
    return res.status(400).json({ success: false, message: 'Quantity must be positive.' });

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart?.items?.length)
    return res.status(404).json({ success: false, message: 'Cart is empty.' });

  const itemIdx = cart.items.findIndex((i) => i.medicine.toString() === medicineId);

  if (itemIdx === -1)
    return res.status(404).json({ success: false, message: 'Item not in cart.' });

  if (quantityNum === 0) {
    cart.items.splice(itemIdx, 1);
    if (cart.items.length === 0) cart.store = null;
  } else {
    // Validate against current best-available stock across all stores
    const med = await Medicine.findById(medicineId).lean();
    const now = new Date();
    const maxAvailable = (med?.inventory || []).reduce(
      (max, inv) =>
        inv.isActive && !inv.isExpired && inv.expiryDate > now
          ? Math.max(max, inv.stockQuantity)
          : max,
      0
    );

    if (!maxAvailable)
      return res.status(400).json({ success: false, message: `"${med?.brandName}" is out of stock.` });

    if (quantityNum > maxAvailable)
      return res.status(400).json({
        success:        false,
        message:        `Insufficient stock. Maximum available: ${maxAvailable}.`,
        availableStock: maxAvailable,
      });

    cart.items[itemIdx].quantity = quantityNum;
  }

  await cart.save();
  await cart.populate('items.medicine', 'brandName genericName images isPrescriptionRequired');
  res.status(200).json({ success: true, cart: cart.toObject() });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /api/pharmacy/cart
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/cart', protect, asyncHandler(async (req, res) => {
  await clearCart(req.user._id);
  logAudit('CART_CLEARED', { userId: req.user._id });
  res.status(200).json({ success: true, message: 'Cart cleared.' });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 5a. POST /api/pharmacy/cart/prescription
// ─────────────────────────────────────────────────────────────────────────────

router.post('/cart/prescription', protect, asyncHandler(async (req, res) => {
  const { medicineId, imageUrl } = req.body;
  if (!medicineId) return res.status(400).json({ success: false, message: 'medicineId is required.' });
  if (!imageUrl)   return res.status(400).json({ success: false, message: 'imageUrl is required.' });
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http'))
    return res.status(400).json({ success: false, message: 'imageUrl must be a valid URL.' });

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart?.items?.length) return res.status(404).json({ success: false, message: 'Cart is empty.' });

  const itemIdx = cart.items.findIndex((i) => i.medicine.toString() === medicineId.toString());
  if (itemIdx === -1) return res.status(404).json({ success: false, message: 'Medicine not in cart.' });
  if (!cart.items[itemIdx].isPrescriptionRequired)
    return res.status(400).json({ success: false, message: 'This medicine does not require a prescription.' });

  cart.items[itemIdx].prescription = { isRequired: true, imageUrl, uploadedAt: new Date() };
  await cart.save();
  await cart.populate('items.medicine', 'brandName genericName images isPrescriptionRequired');

  logAudit('CART_PRESCRIPTION_UPLOAD', { userId: req.user._id, medicineId, imageUrl });
  res.status(200).json({ success: true, message: 'Prescription uploaded.', cart: cart.toObject() });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 5b. POST /api/pharmacy/cart/prescription/upload
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/cart/prescription/upload',
  protect,
  upload.single('prescription'),
  asyncHandler(async (req, res) => {
    const { medicineId } = req.body;
    if (!medicineId) return res.status(400).json({ success: false, message: 'medicineId is required.' });
    if (!req.file)   return res.status(400).json({ success: false, message: 'Prescription file is required.' });

    let imageUrl;
    try {
      imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/prescriptions/cart');
    } catch (err) {
      logError('CART_PRESCRIPTION_IMAGEKIT', err, { userId: req.user._id, medicineId });
      return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart?.items?.length) return res.status(404).json({ success: false, message: 'Cart is empty.' });

    const itemIdx = cart.items.findIndex((i) => i.medicine.toString() === medicineId.toString());
    if (itemIdx === -1) return res.status(404).json({ success: false, message: 'Medicine not in cart.' });
    if (!cart.items[itemIdx].isPrescriptionRequired)
      return res.status(400).json({ success: false, message: 'This medicine does not require a prescription.' });

    cart.items[itemIdx].prescription = { isRequired: true, imageUrl, uploadedAt: new Date() };
    await cart.save();
    await cart.populate('items.medicine', 'brandName genericName images isPrescriptionRequired');

    res.status(200).json({
      success: true, message: 'Prescription uploaded and saved to cart.',
      imageUrl, cart: cart.toObject(),
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/pharmacy/coupon/validate
// ─────────────────────────────────────────────────────────────────────────────

router.post('/coupon/validate', protect, asyncHandler(async (req, res) => {
  const { couponCode, orderTotal } = req.body;
  if (!couponCode) return res.status(400).json({ success: false, message: 'couponCode is required.' });
  const orderTotalNum = parseFloat(orderTotal);
  if (!orderTotalNum || orderTotalNum <= 0)
    return res.status(400).json({ success: false, message: 'Valid orderTotal required.' });
  try {
    const { coupon, discountAmount } = await validateAndApplyCoupon(couponCode, req.user._id, orderTotalNum);
    res.status(200).json({
      success: true, message: `Coupon applied! You save ₹${discountAmount}.`,
      couponCode: coupon.code, discountAmount,
      benefitType: coupon.benefit?.type, benefitValue: coupon.benefit?.value,
      maxCap: coupon.benefit?.maxCap ?? null,
      finalTotal: parseFloat((orderTotalNum - discountAmount).toFixed(2)),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/pharmacy/order/checkout  (MULTI-STORE, CORRECTED)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/checkout', protect, asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { address, paymentMethod = 'Razorpay', couponCode } = req.body;

    try { validateDeliveryAddress(address); }
    catch (error) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!['Razorpay', 'Wallet', 'COD'].includes(paymentMethod)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid payment method.' });
    }

    // ── Load cart ────────────────────────────────────────────────────────────
    const cart = await Cart.findOne({ user: req.user._id })
      .populate({
        path:   'items.medicine',
        select: 'brandName genericName images gstPercentage isPrescriptionRequired mrp inventory isDiscontinued hsnCode',
      })
      .session(session);

    if (!cart?.items?.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    // ── Build plain cart items list (safe, coerced values) ───────────────────
    const cartItemsPlain = cart.items.map((item) => {
      const qty = parseInt(item.quantity, 10);
      return {
        medicine:               item.medicine,           // populated Mongoose doc
        quantity:               isNaN(qty) ? 0 : qty,
        pricePerUnit:           Number(item.pricePerUnit) || null,
        gstPercentage:          Number(item.gstPercentage) || 0,
        isPrescriptionRequired: Boolean(item.isPrescriptionRequired),
        prescription:           item.prescription
          ? {
              isRequired: item.prescription.isRequired,
              imageUrl:   item.prescription.imageUrl ?? null,
              uploadedAt: item.prescription.uploadedAt ?? null,
            }
          : null,
      };
    });

    // ── Multi-store resolution (corrected algorithm) ─────────────────────────
    const customerUser = await User.findById(req.user._id).select('location').lean();
    let groups, unavailableItems;
    try {
      ({ groups, unavailableItems } = await resolveMultiStoreForCart(cartItemsPlain, customerUser));
    } catch (error) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!groups.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'None of your cart items are available at any open store.',
        unavailableItems,
      });
    }

    // ── Subscription discount ────────────────────────────────────────────────
    const subscriptionDiscountPct = await resolvePharmacyDiscount(req.user._id);

    // ── Compute grand total (pre-coupon) for wallet preflight ────────────────
  // ── Compute grand total (pre-coupon) for wallet preflight ────────────────
    const computeGroupTotal = (groupItems) => {
      let itemsTotal = 0;
      for (const item of groupItems) {
        const price = Number(item._resolvedInv?.pricePerUnit) || Number(item.medicine?.mrp) || Number(item.pricePerUnit) || 0;
        itemsTotal += price * item.quantity;
      }
      const subDisc = (itemsTotal * subscriptionDiscountPct) / 100;
      return Math.max(0, itemsTotal - subDisc);
    };

    const grandTotal = groups.reduce((acc, g) => acc + computeGroupTotal(g.items), 0);

    // ── Wallet preflight ─────────────────────────────────────────────────────
    let wallet = null;
    if (paymentMethod === 'Wallet') {
      wallet = await Wallet.findOne({ user: req.user._id }).session(session);
      if (!wallet)          throw new Error('Wallet not found.');
      if (!wallet.isActive) throw new Error('Wallet is inactive.');
      if (wallet.balance < grandTotal)
        throw new Error(
          `Insufficient wallet balance. Required: ₹${grandTotal.toFixed(2)}, Available: ₹${wallet.balance}.`
        );
    }

    // ── Coupon validation ────────────────────────────────────────────────────
    let appliedCoupon     = null;
    let couponDiscountAmt = 0;

    if (couponCode) {
      try {
        const r = await validateAndApplyCoupon(couponCode, req.user._id, grandTotal, session);
        couponDiscountAmt = r.discountAmount;
        appliedCoupon     = r.coupon;
      } catch (error) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    // ── Create one PharmacyOrder per store group ──────────────────────────────
    const createdOrders = [];
    let remainingCouponDiscount = couponDiscountAmt;

    for (const group of groups) {
      const { storeDoc, items: groupItems } = group;
      const storeId    = storeDoc._id.toString();
      const storeObjId = storeDoc._id;

      // ── Build order items ────────────────────────────────────────────────
// ── Build order items ────────────────────────────────────────────────
      const orderItems = groupItems.map((item) => {
        const med = item.medicine;

        const qty = parseInt(item.quantity, 10);
        if (!qty || isNaN(qty) || qty <= 0) {
          throw new Error(
            `Invalid quantity for "${med?.brandName ?? 'Medicine'}". Received: ${item.quantity}.`
          );
        }

        const pricePerUnit =
          Number(item._resolvedInv?.pricePerUnit) ||
          Number(med?.mrp) ||
          Number(item.pricePerUnit);
        if (!pricePerUnit || isNaN(pricePerUnit)) {
          throw new Error(`Missing price for "${med?.brandName ?? 'Medicine'}".`);
        }

        const gstPct = Number(med?.gstPercentage) || Number(item.gstPercentage) || 5;

        return {
          medicine:               med._id,
          name:                   med.brandName ?? med.genericName ?? 'Medicine',
          brandName:              med.brandName,
          genericName:            med.genericName,
          medicineImage:          med.images?.[0]?.url || null,
          hsnCode:                med.hsnCode,
          gstPercentage:          gstPct,
          quantity:               qty,
          pricePerUnit:           parseFloat(pricePerUnit.toFixed(2)),
          taxAmount:              0, // Will be computed accurately post-deductions below
          totalPrice:             parseFloat((pricePerUnit * qty).toFixed(2)),
          isPrescriptionRequired: Boolean(item.isPrescriptionRequired ?? med.isPrescriptionRequired),
        };
      });

      const subTotal   = parseFloat(orderItems.reduce((s, i) => s + i.totalPrice, 0).toFixed(2));
      const subDiscAmt = parseFloat(((subTotal * subscriptionDiscountPct) / 100).toFixed(2));

      const groupCouponDisc = remainingCouponDiscount > 0
        ? Math.min(remainingCouponDiscount, Math.max(0, subTotal - subDiscAmt))
        : 0;
      remainingCouponDiscount = parseFloat((remainingCouponDiscount - groupCouponDisc).toFixed(2));

      const totalDiscountAmount = parseFloat((subDiscAmt + groupCouponDisc).toFixed(2));
      const totalPayable        = parseFloat(Math.max(0, subTotal - totalDiscountAmount).toFixed(2));

      // Pro-rata discount factor to distribute price deductions and record precise GST values
      const discountFactor = subTotal > 0 ? totalPayable / subTotal : 0;
      let gstAmount = 0;
      orderItems.forEach((item) => {
        const itemPaidShare = item.totalPrice * discountFactor;
        item.taxAmount = parseFloat((itemPaidShare * item.gstPercentage / (100 + item.gstPercentage)).toFixed(2));
        gstAmount += item.taxAmount;
      });
      gstAmount = parseFloat(gstAmount.toFixed(2));

      const orderPrescription = buildOrderPrescription(groupItems);

      // ── Live stock re-validation inside the transaction ─────────────────
      // Re-read the medicine documents inside the session to catch any
      // concurrent updates that may have happened since resolution.
     for (const orderItem of orderItems) {
  const liveMed = await Medicine.findById(orderItem.medicine).session(session);
  const now = new Date();
  // Sum across ALL active, non-expired entries for this store — a medicine
  // can have multiple inventory sub-documents for the same store (e.g. different
  // batches), so we must aggregate rather than pick the first match.
  const totalAvailableAtStore = (liveMed?.inventory ?? [])
    .filter(
      (inv) =>
        new mongoose.Types.ObjectId(inv.storeId).equals(storeObjId) &&
        inv.isActive &&
        !inv.isExpired &&
        inv.expiryDate > now
    )
    .reduce((sum, inv) => sum + (inv.stockQuantity || 0), 0);

  if (totalAvailableAtStore < orderItem.quantity) {
    throw new Error(
      `Stock changed for "${orderItem.name}" at "${storeDoc.storeName}". ` +
      `Available: ${totalAvailableAtStore}, requested: ${orderItem.quantity}. Please retry.`
    );
  }
}

      const order = new PharmacyOrder({
        customer:     req.user._id,
        store:        storeObjId,
        items:        orderItems,
        prescription: orderPrescription,
        billing: {
          subTotal,
          gstAmount,
          discountAmount: totalDiscountAmount,
          promoCode:      groupCouponDisc > 0 ? appliedCoupon?.code : undefined,
          totalPayable,
        },
        delivery: { address },
        payment:  { method: paymentMethod },
      });

      // ── Payment handling ─────────────────────────────────────────────────
      if (paymentMethod === 'Razorpay') {
        const rzpOrder = await razorpay.orders.create({
          amount:   Math.round(totalPayable * 100),
          currency: 'INR',
          receipt:  order._id.toString(),
        });
        order.payment.razorpayOrderId = rzpOrder.id;
      }

      if (paymentMethod === 'COD') {
        await decrementStock(orderItems, storeId, session);
        order.delivery.status = 'Placed';
      }

      if (paymentMethod === 'Wallet') {
        const balanceBefore = wallet.balance;
        wallet.balance      = parseFloat((wallet.balance - totalPayable).toFixed(2));
        wallet.transactions.push({
          transactionId: `TXN-${Date.now()}-${storeId.slice(-4)}`,
          type:          'Debit',
          amount:        totalPayable,
          purpose:       'Medicine_Purchase',
          referenceId:   order._id,
          onModel:       'PharmacyOrder',
          status:        'Success',
          balanceBefore,
          balanceAfter:  wallet.balance,
          description:   `Payment for Order #${order.orderId} — ${storeDoc.storeName}`,
        });
        await decrementStock(orderItems, storeId, session);
        order.payment.status  = 'Paid';
        order.payment.paidAt  = new Date();
        order.delivery.status = 'Placed';
      }

      await order.save({ session });
      createdOrders.push({ order: order.toObject(), storeDoc });
    }

    // ── Finalise ──────────────────────────────────────────────────────────────
    if (appliedCoupon) await commitCouponUsage(appliedCoupon._id, session);
    if (paymentMethod === 'Wallet' && wallet) await wallet.save({ session });
    await clearCart(req.user._id, session);
    await session.commitTransaction();

    logAudit('ORDER_CHECKOUT_MULTI', {
      userId:     req.user._id,
      orderIds:   createdOrders.map((o) => o.order._id),
      orderCount: createdOrders.length,
      paymentMethod,
    });

    await syslog('success', 'payment', `Customer placed ${createdOrders.length} order(s) via checkout`, {
      actor:   actorFromReq(req),
      request: { method: 'POST', path: req.originalUrl, statusCode: 201 },
      metadata: {
        paymentMethod,
        orderCount:       createdOrders.length,
        couponCode:       appliedCoupon?.code ?? null,
        unavailableCount: unavailableItems.length,
      },
    });

    // Dispatch confirmation emails (non-blocking)
    if (paymentMethod !== 'Razorpay') {
      for (const { order, storeDoc } of createdOrders) {
        const headerNote = appliedCoupon && order.billing.promoCode
          ? `Coupon ${appliedCoupon.code} applied — you saved ₹${couponDiscountAmt}!`
          : '';
        dispatchOrderConfirmationEmail(req.user._id, order, storeDoc.storeName, headerNote);
      }
    }

 res.status(201).json({
      success:     true,
      order:       createdOrders[0]?.order, // <-- ADDED: Prevents frontend 'payment' undefined crash
      orders:      createdOrders.map((o) => o.order),
      razorpayKey: RAZORPAY_KEY_ID,
      orderCount:  createdOrders.length,
      ...(unavailableItems.length > 0 && {
        warning: {
          message:          'Some items were unavailable and were not included in any order.',
          unavailableItems,
        },
      }),
    });
  } catch (err) {
    await session.abortTransaction();
    logError('CHECKOUT_ERROR', err, { userId: req.user._id });
    await syslog('error', 'payment', `Checkout failed: ${err.message}`, {
      actor:   actorFromReq(req),
      request: { method: 'POST', path: req.originalUrl, statusCode: 500 },
      metadata: { error: err.message },
    });
    throw err;
  } finally { session.endSession(); }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/pharmacy/order/verify
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/verify', protect, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ success: false, message: 'Missing payment verification details.' });

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

  if (hmac !== razorpay_signature) {
    logAudit('PAYMENT_VERIFICATION_FAILED', { userId: req.user._id, rzpOrderId: razorpay_order_id });
    return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await PharmacyOrder.findOne({
      'payment.razorpayOrderId': razorpay_order_id, customer: req.user._id,
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
  if (order.payment?.status === 'Paid') {
      await session.abortTransaction();
      return res.status(200).json({ success: true, message: 'Already paid.', order });
    }

    await decrementStock(order.items, order.store.toString(), session);
    order.payment.status            = 'Paid';
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.paidAt            = new Date();
    order.delivery.status           = 'Placed';
    await order.save({ session });
    await session.commitTransaction();

    logAudit('PAYMENT_VERIFIED', { userId: req.user._id, orderId: order._id });

    const storeDoc = await PharmacyStore.findById(order.store).select('storeName').lean();
    dispatchOrderConfirmationEmail(req.user._id, order.toObject(), storeDoc?.storeName ?? 'Likeson Pharmacy');

    res.status(200).json({ success: true, order });
  } catch (err) {
    await session.abortTransaction();
    logError('PAYMENT_VERIFICATION_ERROR', err, { userId: req.user._id });
    throw err;
  } finally { session.endSession(); }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 9. POST /api/pharmacy/wallet/pay
// ─────────────────────────────────────────────────────────────────────────────

router.post('/wallet/pay', protect, asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await findOrderSafe(orderId, { customer: req.user._id }, session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
   if (order.payment?.status === 'Paid') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Order already paid.' });
    }

    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet)          throw new Error('Wallet not found.');
    if (!wallet.isActive) throw new Error('Wallet is inactive.');
    if (wallet.balance < order.billing.totalPayable)
      throw new Error(
        `Insufficient wallet balance. Required: ₹${order.billing.totalPayable}, Available: ₹${wallet.balance}.`
      );

    const balanceBefore = wallet.balance;
    wallet.balance      = parseFloat((wallet.balance - order.billing.totalPayable).toFixed(2));
    wallet.transactions.push({
      transactionId: `TXN-${Date.now()}`,
      type:          'Debit',
      amount:        order.billing.totalPayable,
      purpose:       'Medicine_Purchase',
      referenceId:   order._id,
      onModel:       'PharmacyOrder',
      status:        'Success',
      balanceBefore,
      balanceAfter:  wallet.balance,
      description:   `Payment for Order #${order.orderId}`,
    });

    await decrementStock(order.items, order.store.toString(), session);
    order.payment.status  = 'Paid';
    order.payment.paidAt  = new Date();
    order.delivery.status = 'Confirmed';
    await wallet.save({ session });
    await order.save({ session });
    await clearCart(req.user._id, session);
    await session.commitTransaction();

    const storeDoc   = await PharmacyStore.findById(order.store).select('storeName').lean();
    const headerNote = `Remaining wallet balance: ₹${wallet.balance}`;
    dispatchOrderConfirmationEmail(req.user._id, order.toObject(), storeDoc?.storeName ?? 'Likeson Pharmacy', headerNote);

    res.status(200).json({ success: true, order });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    logError('WALLET_PAYMENT_ERROR', error, { userId: req.user._id });
    throw error;
  } finally { session.endSession(); }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET /api/pharmacy/orders/my-orders
// ─────────────────────────────────────────────────────────────────────────────

router.get('/orders/my-orders', protect, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;
  const filter   = { customer: req.user._id };
  if (status) filter['delivery.status'] = status;

  const [orders, total] = await Promise.all([
    PharmacyOrder.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(limitNum)
      .populate('store', 'storeName address')
      .lean(),
    PharmacyOrder.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    pagination: { total, pages: Math.ceil(total / limitNum), page: pageNum, limit: limitNum },
    orders,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /api/pharmacy/orders/:id
// ─────────────────────────────────────────────────────────────────────────────

router.get('/orders/:id', protect, asyncHandler(async (req, res) => {
  const order = await findOrderSafe(req.params.id, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  await order.populate('store', 'storeName address contact');
  await order.populate('items.medicine', 'brandName genericName dosage packaging images');
  await order.populate('prescription.verifiedBy', 'name email');
  res.status(200).json({ success: true, order });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 11a. POST /api/pharmacy/order/upload-prescription
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/upload-prescription', protect, asyncHandler(async (req, res) => {
  const { orderId, imageUrl } = req.body;
  if (!orderId)  return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!imageUrl) return res.status(400).json({ success: false, message: 'imageUrl is required.' });
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http'))
    return res.status(400).json({ success: false, message: 'imageUrl must be a valid URL.' });

  const order = await findOrderSafe(orderId, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (!order.prescription?.isRequired)
    return res.status(400).json({ success: false, message: 'No prescription required for this order.' });

  const notAllowed = ['Delivered', 'Cancelled', 'Return_Requested', 'Return_Accepted', 'Pickup_Assigned', 'Pickup_Done', 'Returned'];
  if (notAllowed.includes(order.delivery.status))
    return res.status(400).json({ success: false, message: `Cannot upload prescription for status: ${order.delivery.status}.` });
  if (order.prescription.verificationStatus === 'Approved')
    return res.status(400).json({ success: false, message: 'Prescription already approved.' });

  order.prescription.imageUrl           = imageUrl;
  order.prescription.uploadedAt         = new Date();
  order.prescription.verificationStatus = 'Pending';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Prescription uploaded. Pending pharmacist verification.',
    prescription: order.prescription,
  });
}));


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pharmacy/medicines/:id/similar
// Fetch similar medicines based on the category of the provided medicine ID
// ─────────────────────────────────────────────────────────────────────────────

router.get('/medicines/:id/similar', cache(120), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit, 10) || 10;

  // 1. Find the base medicine and fetch fields needed to determine similarity
  const baseMedicine = await Medicine.findById(id)
    .select('category genericName therapeuticClass pharmacologicalClass')
    .lean();

  if (!baseMedicine) {
    return res.status(404).json({ success: false, message: 'Medicine not found.' });
  }

  // 2. Build the similarity conditions
  // We want to find medicines that share at least one medical trait with the base medicine.
  const similarityConditions = [];
  
  if (baseMedicine.genericName) {
    similarityConditions.push({ genericName: baseMedicine.genericName }); // Direct substitutes
  }
  if (baseMedicine.therapeuticClass) {
    similarityConditions.push({ therapeuticClass: baseMedicine.therapeuticClass }); // Same use-case
  }
  if (baseMedicine.pharmacologicalClass) {
    similarityConditions.push({ pharmacologicalClass: baseMedicine.pharmacologicalClass }); // Same drug family
  }

  // 3. Construct the final query
  const matchQuery = {
    _id: { $ne: id },                      // Exclude the currently viewed medicine
    isDiscontinued: false,                 // Only show active listings
    category: baseMedicine.category,       // STRICT: Must be in the exact same category
  };

  // If we have similarity conditions, apply them using $or
  if (similarityConditions.length > 0) {
    matchQuery.$or = similarityConditions;
  }

  // 4. Execute the query
  const similarMedicines = await Medicine.find(matchQuery)
    .sort({ 'inventory.stockQuantity': -1, createdAt: -1 }) // Prioritize items in stock
    .limit(limit)
    .populate('inventory.storeId', 'storeName address status') 
    .lean();

  res.status(200).json({
    success: true,
    category: baseMedicine.category,
    medicines: similarMedicines,
  });
}));
 
// ─────────────────────────────────────────────────────────────────────────────
// 11b. POST /api/pharmacy/order/upload-prescription/file
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/order/upload-prescription/file',
  protect,
  upload.single('prescription'),
  asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Prescription file is required.' });

    const order = await findOrderSafe(orderId, { customer: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.prescription?.isRequired)
      return res.status(400).json({ success: false, message: 'No prescription required for this order.' });

    const notAllowed = ['Delivered', 'Cancelled', 'Return_Requested', 'Return_Accepted', 'Pickup_Assigned', 'Pickup_Done', 'Returned'];
    if (notAllowed.includes(order.delivery.status))
      return res.status(400).json({ success: false, message: `Cannot upload prescription for status: ${order.delivery.status}.` });
    if (order.prescription.verificationStatus === 'Approved')
      return res.status(400).json({ success: false, message: 'Prescription already approved.' });

    let imageUrl;
    try {
      imageUrl = await uploadToImageKit(req.file.buffer, req.file.originalname, '/prescriptions/orders');
    } catch (err) {
      logError('ORDER_PRESCRIPTION_IMAGEKIT', err, { userId: req.user._id, orderId });
      return res.status(500).json({ success: false, message: 'Failed to upload prescription to storage.' });
    }

    order.prescription.imageUrl           = imageUrl;
    order.prescription.uploadedAt         = new Date();
    order.prescription.verificationStatus = 'Pending';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Prescription uploaded. Pending pharmacist verification.',
      imageUrl,
      prescription: order.prescription,
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 12. GET /api/pharmacy/orders/:id/invoice
// ─────────────────────────────────────────────────────────────────────────────

router.get('/orders/:id/invoice', protect, asyncHandler(async (req, res) => {
  const order = await findOrderSafe(req.params.id, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  await order.populate('store', 'storeName address contact legal');
  const user  = await User.findById(req.user._id).select('name email phone').lean();
  const store = order.store;

  const { html, invoiceUrl } = await generateInvoice({
    order: order.toObject(), user,
    store: store ? (typeof store.toObject === 'function' ? store.toObject() : store) : null,
  });

  if (invoiceUrl) {
    PharmacyOrder.findByIdAndUpdate(order._id, { $set: { 'billing.invoiceUrl': invoiceUrl } })
      .catch((e) => logError('INVOICE_URL_SAVE', e));
  }

  if (user?.email) {
    sendEmail({ email: user.email, subject: `[Likeson Healthcare] Invoice — Order #${order.orderId}`, html })
      .catch((err) => logError('INVOICE_EMAIL_ERROR', err));
  }

  if (invoiceUrl) res.setHeader('X-Invoice-Url', invoiceUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}));

// ─────────────────────────────────────────────────────────────────────────────
// 12a. GET /api/pharmacy/orders/:id/invoice/download
// ─────────────────────────────────────────────────────────────────────────────

router.get('/orders/:id/invoice/download', protect, asyncHandler(async (req, res) => {
  const order = await findOrderSafe(req.params.id, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

  await order.populate('store', 'storeName address contact legal');
  const user  = await User.findById(req.user._id).select('name email phone').lean();
  const store = order.store;

  const { html, invoiceUrl } = await generateInvoice({
    order: order.toObject(), user,
    store: store ? (typeof store.toObject === 'function' ? store.toObject() : store) : null,
  });

  if (invoiceUrl) res.setHeader('X-Invoice-Url', invoiceUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.html"`);
  res.status(200).send(html);
}));

// ─────────────────────────────────────────────────────────────────────────────
// 13. POST /api/pharmacy/order/cancel
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/cancel', protect, asyncHandler(async (req, res) => {
  const { orderId, reason = 'Customer requested cancellation' } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await findOrderSafe(orderId, { customer: req.user._id }, session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const nonCancellable = ['Delivered', 'Return_Requested', 'Return_Accepted', 'Pickup_Assigned', 'Pickup_Done', 'Returned'];
    if (nonCancellable.includes(order.delivery.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.delivery.status}.`,
      });
    }

    order.cancellation.isCancelled = true;
    order.cancellation.reason      = reason;
    order.cancellation.cancelledBy = req.user._id;
    order.cancellation.cancelledAt = new Date();
    order.delivery.status          = 'Cancelled';

if (order.payment?.status === 'Paid') {
      order.cancellation.refundStatus = 'Requested';
      order.cancellation.refundMethod = 'Original_Source';
      order.cancellation.refundAmount = order.billing.totalPayable;
      await incrementStock(order.items, order.store.toString(), session);

      // Immediate wallet refund if paid by wallet
      if (order.payment?.method === 'Wallet') {
        const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
        if (wallet) {
          const balanceBefore = wallet.balance;
          wallet.balance      = parseFloat((wallet.balance + order.billing.totalPayable).toFixed(2));
          wallet.transactions.push({
            transactionId: `TXN-${Date.now()}`,
            type:          'Credit',
            amount:        order.billing.totalPayable,
            purpose:       'Refund',
            referenceId:   order._id,
            onModel:       'PharmacyOrder',
            status:        'Success',
            balanceBefore,
            balanceAfter:  wallet.balance,
            description:   `Refund for cancelled order #${order.orderId}`,
          });
          await wallet.save({ session });
          order.cancellation.refundStatus = 'Processed';
          order.cancellation.refundMethod = 'Wallet';
        }
      }
    }

    await order.save({ session });
    await session.commitTransaction();

    logAudit('ORDER_CANCELLED', { userId: req.user._id, orderId: order._id });

    dispatchNotification(req.user._id, {
      title:        'Order Cancelled',
      body:         `Order #${order.orderId} has been cancelled.`,
      type:         'Order_Cancelled',
      emailSubject: 'Order Cancellation Confirmation',
      emailBody:    `Your order #${order.orderId} has been cancelled.${
        order.payment.status === 'Paid'
          ? ` A refund of ₹${order.billing.totalPayable} will be processed.`
          : ''
      }`,
      actionLink: `https://likeson.in/pharmacy/orders/${order._id}`,
    });

    res.status(200).json({ success: true, message: 'Order cancelled.', order });
  } catch (error) {
    await session.abortTransaction();
    logError('CANCEL_ERROR', error, { orderId });
    throw error;
  } finally { session.endSession(); }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 14. POST /api/pharmacy/order/request-return
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/request-return', protect, asyncHandler(async (req, res) => {
  const { orderId, returnReason, evidence, refundMethod, bankDetails } = req.body;

  if (!orderId)      return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!returnReason) return res.status(400).json({ success: false, message: 'returnReason is required.' });
  if (returnReason.length < 10)
    return res.status(400).json({ success: false, message: 'returnReason must be at least 10 characters.' });
  if (!evidence || !Array.isArray(evidence) || evidence.length === 0)
    return res.status(400).json({ success: false, message: 'Evidence is required. Please upload at least one image or video.' });

  const validMediaTypes = ['image', 'video'];
  for (const item of evidence) {
    if (!item.url)
      return res.status(400).json({ success: false, message: 'Each evidence item must have a url.' });
    if (!validMediaTypes.includes(item.mediaType))
      return res.status(400).json({ success: false, message: 'Each evidence mediaType must be "image" or "video".' });
  }

  const validRefundMethods = ['Wallet', 'Online', 'Bank_Transfer', 'Custom_Bank'];
  if (!refundMethod || !validRefundMethods.includes(refundMethod))
    return res.status(400).json({ success: false, message: `refundMethod is required. Valid options: ${validRefundMethods.join(', ')}.` });

  if (['Bank_Transfer', 'Custom_Bank'].includes(refundMethod)) {
    if (!bankDetails)
      return res.status(400).json({ success: false, message: 'bankDetails are required for bank transfer refund.' });
    const reqFields = ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName'];
    const missing   = reqFields.filter((f) => !bankDetails[f]);
    if (missing.length)
      return res.status(400).json({ success: false, message: `Missing bank details: ${missing.join(', ')}.` });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(bankDetails.ifscCode))
      return res.status(400).json({ success: false, message: 'Invalid IFSC code format.' });
  }

  const order = await findOrderSafe(orderId, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (order.delivery.status !== 'Delivered')
    return res.status(400).json({ success: false, message: `Cannot return order with status: ${order.delivery.status}.` });
  if (order.cancellation?.isReturnRequested)
    return res.status(400).json({ success: false, message: 'Return already requested.' });

  const deliveredAt = order.delivery.deliveredAt || order.updatedAt;
  const daysElapsed = (Date.now() - deliveredAt) / (1000 * 60 * 60 * 24);
  if (daysElapsed > 7)
    return res.status(400).json({ success: false, message: 'Return window closed. Returns allowed within 7 days of delivery.' });

  order.cancellation.isReturnRequested    = true;
  order.cancellation.returnReason         = returnReason;
  order.cancellation.returnRequestedAt    = new Date();
  order.cancellation.returnRequestedBy    = req.user._id;
  order.cancellation.returnDecision       = 'Pending';
  order.cancellation.returnEvidence       = evidence.map((e) => ({ mediaType: e.mediaType, url: e.url, uploadedAt: new Date() }));
  order.cancellation.selectedRefundMethod = refundMethod;
  if (['Bank_Transfer', 'Custom_Bank'].includes(refundMethod) && bankDetails)
    order.cancellation.bankDetails = bankDetails;
  order.delivery.status = 'Return_Requested';
  await order.save();

  dispatchNotification(req.user._id, {
    title:        'Return Request Submitted',
    body:         `Return request for order #${order.orderId} submitted.`,
    type:         'Return_Requested',
    emailSubject: 'Return Request Confirmed',
    emailBody:    `Your return request for order #${order.orderId} has been received. Our team will review within 24 hours.\n\nRefund method selected: ${refundMethod}.`,
    actionLink:   `https://likeson.in/pharmacy/orders/${order._id}`,
  });

  res.status(200).json({ success: true, message: 'Return request submitted.', order });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 15. POST /api/pharmacy/order/submit-feedback
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/submit-feedback', protect, asyncHandler(async (req, res) => {
  const { orderId, rating, comment } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ success: false, message: 'Rating must be 1–5.' });
  if (comment && comment.length > 500)
    return res.status(400).json({ success: false, message: 'Comment max 500 chars.' });

  const order = await findOrderSafe(orderId, { customer: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  if (order.delivery.status !== 'Delivered')
    return res.status(400).json({ success: false, message: 'Only delivered orders can be reviewed.' });
  if (order.customerFeedback?.createdAt)
    return res.status(400).json({ success: false, message: 'Feedback already submitted.' });

  order.customerFeedback = { rating: parseInt(rating, 10), comment: comment || '', createdAt: new Date() };
  await order.save();

  res.status(200).json({ success: true, message: 'Thank you for your feedback!', order });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 16. POST /api/pharmacy/wallet/add-money
// ─────────────────────────────────────────────────────────────────────────────

router.post('/wallet/add-money', protect, asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount || parseFloat(amount) < 100)
    return res.status(400).json({ success: false, message: 'Minimum top-up is ₹100.' });
  const amountNum = parseFloat(amount);
  if (amountNum > 100000)
    return res.status(400).json({ success: false, message: 'Maximum top-up is ₹1,00,000.' });

  const rzpOrder = await razorpay.orders.create({
    amount:   Math.round(amountNum * 100),
    currency: 'INR',
    receipt:  `TOPUP_${req.user._id}_${Date.now()}`,
  });

  res.status(200).json({ success: true, rzpOrder, razorpayKey: RAZORPAY_KEY_ID });
}));

// ─────────────────────────────────────────────────────────────────────────────
// 17. POST /api/pharmacy/wallet/verify-topup
// ─────────────────────────────────────────────────────────────────────────────

router.post('/wallet/verify-topup', protect, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ success: false, message: 'Missing payment verification details.' });

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  if (hmac !== razorpay_signature)
    return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      throw new Error('Wallet not found.');
    }

    const amountNum     = parseFloat(amount);
    const balanceBefore = wallet.balance;
    wallet.balance      = parseFloat((wallet.balance + amountNum).toFixed(2));

    // Use the Wallet model's transaction schema fields correctly
    wallet.transactions.push({
      transactionId: `TXN-${Date.now()}`,
      type:          'Credit',
      amount:        amountNum,
      purpose:       'Add_Money',       // ← matches Wallet model enum + withdrawable
      status:        'Success',
      balanceBefore,
      balanceAfter:  wallet.balance,
      description:   `Wallet top-up of ₹${amountNum}`,
    });

    await wallet.save({ session });
    await session.commitTransaction();

    logAudit('WALLET_TOPUP', { userId: req.user._id, amount: amountNum });

    res.status(200).json({ success: true, message: `Wallet topped up with ₹${amountNum}.`, wallet });
  } catch (error) {
    await session.abortTransaction();
    logError('WALLET_TOPUP_ERROR', error, { userId: req.user._id });
    throw error;
  } finally { session.endSession(); }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 18. POST /api/pharmacy/order/direct
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/direct', protect, asyncHandler(async (req, res) => {
  const { medicineId, quantity, address, paymentMethod = 'Razorpay', couponCode, prescription } = req.body;
  const preferredStoreId = extractStoreId(req.body.storeId) || null;

  if (!medicineId || !quantity || !address)
    return res.status(400).json({ success: false, message: 'medicineId, quantity, and address are required.' });

  try { validateDeliveryAddress(address); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }

  if (!['Razorpay', 'Wallet', 'COD'].includes(paymentMethod))
    return res.status(400).json({ success: false, message: 'Invalid payment method.' });

  const quantityNum = parseInt(quantity, 10);
  if (quantityNum < 1)
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });

  const customerUser = await User.findById(req.user._id).select('location').lean();
  let resolvedStore, inventoryEntry, medicine;
  try {
    ({ store: resolvedStore, inventoryEntry, medicine } = await resolveStoreForMedicine(
      medicineId, quantityNum, customerUser, preferredStoreId
    ));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const storeObjId      = resolvedStore._id;
  const storeIdStr      = storeObjId.toString();
  const storeOverridden = preferredStoreId && preferredStoreId !== storeIdStr;

 const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const subscriptionDiscountPct = await resolvePharmacyDiscount(req.user._id);
    const unitPrice      = Number(inventoryEntry.pricePerUnit) || Number(medicine.mrp);
    const subTotal       = parseFloat((unitPrice * quantityNum).toFixed(2));
    const subDiscAmt     = parseFloat((subTotal * (subscriptionDiscountPct / 100)).toFixed(2));
    const preCouponTotal = parseFloat(Math.max(0, subTotal - subDiscAmt).toFixed(2));

    let couponDiscountAmt = 0, appliedCoupon = null;
    if (couponCode) {
      try {
        const r = await validateAndApplyCoupon(couponCode, req.user._id, preCouponTotal, session);
        couponDiscountAmt = r.discountAmount;
        appliedCoupon     = r.coupon;
      } catch (error) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    const totalDiscountAmount = parseFloat((subDiscAmt + couponDiscountAmt).toFixed(2));
    const totalPayable        = parseFloat(Math.max(0, subTotal - totalDiscountAmount).toFixed(2));

    const gstPct    = Number(medicine.gstPercentage) || 5;
    const gstAmount = parseFloat((totalPayable * gstPct / (100 + gstPct)).toFixed(2));

    const orderItem = {
      medicine:               medicine._id,
      name:                   medicine.brandName ?? medicine.genericName ?? 'Medicine',
      brandName:              medicine.brandName,
      genericName:            medicine.genericName,
      medicineImage:          medicine.images?.[0]?.url || null,
      hsnCode:                medicine.hsnCode,
      gstPercentage:          gstPct,
      quantity:               quantityNum,
      pricePerUnit:           unitPrice,
      taxAmount:              gstAmount,
      totalPrice:             subTotal,
      isPrescriptionRequired: medicine.isPrescriptionRequired ?? false,
    };

    if (paymentMethod === 'COD') {
      await decrementStock([orderItem], storeIdStr, session);
      order.delivery.status = 'Placed';
    }

    if (paymentMethod === 'Wallet') {
      const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
      if (!wallet)          throw new Error('Wallet not found.');
      if (!wallet.isActive) throw new Error('Wallet is inactive.');
      if (wallet.balance < totalPayable)
        throw new Error(`Insufficient wallet balance. Required: ₹${totalPayable}, Available: ₹${wallet.balance}.`);

      const balanceBefore = wallet.balance;
      wallet.balance      = parseFloat((wallet.balance - totalPayable).toFixed(2));
      wallet.transactions.push({
        transactionId: `TXN-${Date.now()}`,
        type:          'Debit',
        amount:        totalPayable,
        purpose:       'Medicine_Purchase',
        referenceId:   order._id,
        onModel:       'PharmacyOrder',
        status:        'Success',
        balanceBefore,
        balanceAfter:  wallet.balance,
        description:   `Direct purchase: ${medicine.brandName} — Order #${order.orderId}`,
      });
      await wallet.save({ session });
      await decrementStock([orderItem], storeIdStr, session);
      order.payment.status  = 'Paid';
      order.payment.paidAt  = new Date();
      order.delivery.status = 'Confirmed';
    }

    if (paymentMethod === 'Razorpay') {
      const rzpOrder = await razorpay.orders.create({
        amount:   Math.round(totalPayable * 100),
        currency: 'INR',
        receipt:  order._id.toString(),
      });
      order.payment.razorpayOrderId = rzpOrder.id;
    }

    await order.save({ session });
    if (appliedCoupon) await commitCouponUsage(appliedCoupon._id, session);
    await session.commitTransaction();

    logAudit('DIRECT_ORDER', { userId: req.user._id, orderId: order._id, medicineId, storeId: storeIdStr, storeOverridden });

    if (paymentMethod !== 'Razorpay') {
      const headerNote = appliedCoupon ? `Coupon ${appliedCoupon.code} applied — saved ₹${couponDiscountAmt}!` : '';
      dispatchOrderConfirmationEmail(req.user._id, order.toObject(), resolvedStore.storeName, headerNote);
    }

    res.status(201).json({
      success:           true,
      order,
      razorpayKey:       RAZORPAY_KEY_ID,
      resolvedStoreName: resolvedStore.storeName,
      ...(storeOverridden && {
        notice: `Your preferred store did not have sufficient stock. Order placed from "${resolvedStore.storeName}" instead.`,
      }),
    });
  } catch (err) {
    await session.abortTransaction();
    logError('DIRECT_ORDER_ERROR', err, { userId: req.user._id, medicineId });
    throw err;
  } finally { session.endSession(); }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 19. POST /api/pharmacy/order/direct/verify
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/direct/verify', protect, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ success: false, message: 'Missing payment verification details.' });

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

  if (hmac !== razorpay_signature)
    return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await PharmacyOrder.findOne({
      'payment.razorpayOrderId': razorpay_order_id, customer: req.user._id,
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
if (order.payment?.status === 'Paid') {
      await session.abortTransaction();
      return res.status(200).json({ success: true, message: 'Already paid.', order });
    }

    await decrementStock(order.items, order.store.toString(), session);
    order.payment.status            = 'Paid';
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.paidAt            = new Date();
    order.delivery.status           = 'Confirmed';
    await order.save({ session });
    await session.commitTransaction();

    const storeDoc = await PharmacyStore.findById(order.store).select('storeName').lean();
    dispatchOrderConfirmationEmail(req.user._id, order.toObject(), storeDoc?.storeName ?? 'Likeson Pharmacy');

    res.status(200).json({ success: true, order });
  } catch (err) {
    await session.abortTransaction();
    logError('DIRECT_PAYMENT_ERROR', err, { userId: req.user._id });
    throw err;
  } finally { session.endSession(); }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 20. POST /api/pharmacy/order/verify-delivery-otp
// ─────────────────────────────────────────────────────────────────────────────

router.post('/order/verify-delivery-otp', protect, asyncHandler(async (req, res) => {
  const { orderId, otp } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required.' });
  if (!otp)     return res.status(400).json({ success: false, message: 'otp is required.' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await findOrderSafe(orderId, {}, session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const orderWithOtp = await PharmacyOrder.findById(order._id)
      .select('+deliveryOtp.code +deliveryOtp.expiresAt +deliveryOtp.verified')
      .session(session);

    if (!orderWithOtp.deliveryOtp?.code)
      return res.status(400).json({ success: false, message: 'No OTP generated for this order.' });
    if (orderWithOtp.deliveryOtp.verified)
      return res.status(400).json({ success: false, message: 'OTP already used.' });
    if (new Date() > orderWithOtp.deliveryOtp.expiresAt)
      return res.status(400).json({ success: false, message: 'OTP has expired.' });
    if (orderWithOtp.deliveryOtp.code !== String(otp))
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    orderWithOtp.deliveryOtp.verified = true;
    orderWithOtp.delivery.status      = 'Delivered';
    orderWithOtp.delivery.deliveredAt = new Date();
    await orderWithOtp.save({ session });
    await session.commitTransaction();

    const storeDoc = await PharmacyStore.findById(orderWithOtp.store).select('storeName').lean();
    dispatchStatusUpdateEmail(orderWithOtp.toObject(), 'Delivered', storeDoc?.storeName);

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed. Order marked as Delivered.',
      order:   orderWithOtp,
    });
  } catch (err) {
    await session.abortTransaction();
    logError('OTP_VERIFY_ERROR', err, { orderId });
    throw err;
  } finally { session.endSession(); }
}));

// ═══════════════════════════════════════════════════════════════════════════════
// § ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

router.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  logError('UNHANDLED_ERROR', err, { path: req.originalUrl, method: req.method });

  syslog('error', 'api', `Unhandled router error: ${err.message}`, {
    actor:   req.user ? actorFromReq(req) : { role: 'anonymous', ip: req.ip },
    request: { method: req.method, path: req.originalUrl, statusCode },
    metadata: { stack: err.stack?.slice(0, 500) },
  });

  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10 MB.' });
  if (err.message?.includes('Only JPEG'))
    return res.status(400).json({ success: false, message: err.message });
  if (err.name === 'ValidationError')
    return res.status(400).json({ success: false, message: 'Validation error', errors: Object.values(err.errors).map((e) => e.message) });
  if (err.code === 11000)
    return res.status(400).json({ success: false, message: 'Duplicate entry', field: Object.keys(err.keyValue)[0] });
  if (err.name === 'JsonWebTokenError')
    return res.status(401).json({ success: false, message: 'Invalid token' });
  if (err.name === 'TokenExpiredError')
    return res.status(401).json({ success: false, message: 'Token expired' });

  res.status(statusCode).json({ success: false, message: err.message || 'Internal Server Error' });
});

export default router;