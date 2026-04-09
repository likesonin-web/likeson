import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import PromotionCoupon from '../models/PromotionCoupon.js'; // Adjust path accordingly
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @section UTILITY MIDDLEWARES & HELPERS
 * Internal handlers to maintain enterprise quality without external controller files.
 */

// Global Async Wrapper to eliminate try-catch blocks and ensure no unhandled rejections
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Standardized Validation Result Handler
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
    });
  }
  next();
};

/**
 * @section VALIDATION SCHEMAS
 */
const couponValidation = [
  body('code').notEmpty().withMessage('Coupon code is required').isString().toUpperCase().trim(),
  body('eligibility.type').isIn(['New_User_Only', 'First_Booking', 'Subscription_Renewal', 'General']),
  body('benefit.type').isIn(['Percentage', 'Flat_Amount', 'Free_Ride', 'Free_Consultation']),
  body('benefit.value').isNumeric().withMessage('Benefit value must be a number'),
  body('validity.from').isISO8601().toDate().withMessage('Valid start date is required'),
  body('validity.to').isISO8601().toDate().withMessage('Valid end date is required'),
  validateRequest
];

/**
 * @section ROUTES
 */

/**
 * @route   POST /api/coupons
 * @desc    Create a new promotion coupon
 * @access  Private (Admin/Superadmin)
 */
router.post(
  '/',
  protect,
  authorize('admin', 'superadmin'),
  couponValidation,
  asyncHandler(async (req, res) => {
    // Check for existing code to prevent 11000 mongo error noise
    const existing = await PromotionCoupon.findOne({ code: req.body.code }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await PromotionCoupon.create(req.body);

    // AUDIT LOG
    console.info(`[AUDIT] COUPON_CREATED: ID=${coupon._id} CODE=${coupon.code} BY_USER=${req.user._id}`);

    res.status(201).json({
      success: true,
      data: coupon
    });
  })
);

/**
 * @route   GET /api/coupons
 * @desc    Get all coupons with advanced filtering & pagination
 * @access  Private (Admin/Superadmin)
 */
router.get(
  '/',
  protect,
  authorize('admin', 'superadmin'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('isActive').optional().isBoolean().toBoolean(),
    validateRequest
  ],
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, isActive, search } = req.query;
    const skip = (page - 1) * limit;

    const queryObj = {};
    if (typeof isActive === 'boolean') queryObj.isActive = isActive;
    if (search) queryObj.code = { $regex: search, $options: 'i' };

    // Optimized parallel execution for performance
    const [coupons, total] = await Promise.all([
      PromotionCoupon.find(queryObj)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PromotionCoupon.countDocuments(queryObj)
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
      data: coupons
    });
  })
);

/**
 * @route   POST /api/coupons/validate
 * @desc    Validate a coupon code for the current user session
 * @access  Private (All Users)
 */
router.post(
  '/validate',
  protect,
  [
    body('code').notEmpty().toUpperCase().trim(),
    body('orderValue').isNumeric().withMessage('Order value is required for validation'),
    validateRequest
  ],
  asyncHandler(async (req, res) => {
    const { code, orderValue } = req.body;
    const now = new Date();

    // 1. Find active coupon within date range
    const coupon = await PromotionCoupon.findOne({
      code,
      isActive: true,
      'validity.from': { $lte: now },
      'validity.to': { $gte: now }
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    // 2. Platform Limit Check
    if (coupon.usage.totalPlatformLimit && coupon.usage.currentUses >= coupon.usage.totalPlatformLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    // 3. Minimum Order Value Check
    if (coupon.eligibility.minOrderValue && orderValue < coupon.eligibility.minOrderValue) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum order value of ${coupon.eligibility.minOrderValue} required` 
      });
    }

    // 4. Eligibility logic (e.g., New User check)
    if (coupon.eligibility.type === 'New_User_Only' && req.user.loginCount > 1) {
      return res.status(403).json({ success: false, message: 'Coupon only valid for new users' });
    }

    // 5. Calculate Discount Preview
    let discount = 0;
    if (coupon.benefit.type === 'Percentage') {
      discount = (orderValue * coupon.benefit.value) / 100;
      if (coupon.benefit.maxCap && discount > coupon.benefit.maxCap) {
        discount = coupon.benefit.maxCap;
      }
    } else if (coupon.benefit.type === 'Flat_Amount') {
      discount = coupon.benefit.value;
    }

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      data: {
        code: coupon.code,
        benefitType: coupon.benefit.type,
        estimatedDiscount: discount,
        finalPrice: Math.max(0, orderValue - discount)
      }
    });
  })
);

/**
 * @route   PATCH /api/coupons/:id
 * @desc    Toggle status or update coupon limits
 * @access  Private (Admin/Superadmin)
 */
router.patch(
  '/:id',
  protect,
  authorize('admin', 'superadmin'),
  [param('id').isMongoId().withMessage('Invalid ID format'), validateRequest],
  asyncHandler(async (req, res) => {
    const coupon = await PromotionCoupon.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({ success: true, data: coupon });
  })
);

/**
 * @route   DELETE /api/coupons/:id
 * @desc    Hard delete a coupon (Superadmin only)
 * @access  Private (Superadmin)
 */
router.delete(
  '/:id',
  protect,
  authorize('superadmin'),
  [param('id').isMongoId().withMessage('Invalid ID format'), validateRequest],
  asyncHandler(async (req, res) => {
    const coupon = await PromotionCoupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    console.warn(`[AUDIT] COUPON_DELETED: ID=${req.params.id} BY_USER=${req.user._id}`);
    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  })
);

/**
 * @section ANALYTICS / AGGREGATION
 * @route   GET /api/coupons/stats/usage
 * @desc    Get platform-wide coupon usage metrics
 */
router.get(
  '/stats/usage',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const stats = await PromotionCoupon.aggregate([
      {
        $group: {
          _id: "$eligibility.type",
          totalCoupons: { $sum: 1 },
          totalUsage: { $sum: "$usage.currentUses" },
          activeCoupons: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
          }
        }
      },
      { $sort: { totalUsage: -1 } }
    ]);

    res.status(200).json({ success: true, data: stats });
  })
);

/**
 * @section ERROR HANDLING MIDDLEWARE
 * Localized specialized error handling to prevent server crashes
 */
router.use((err, req, res, next) => {
  // Log critical errors for monitoring (Winston/Sentry style)
  console.error(`[CRITICAL_ERROR] ${err.name}: ${err.message}`, {
    stack: err.stack,
    path: req.originalUrl,
    user: req.user?._id
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Resource already exists' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'An internal system error occurred' 
      : err.message
  });
});

export default router;