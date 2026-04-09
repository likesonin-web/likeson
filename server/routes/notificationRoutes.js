import express from 'express';
import { param, body, validationResult } from 'express-validator';
import Notification from '../models/Notification.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Surfaces async errors to Express's central error handler */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Centralised express-validator result check */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });
    next();
};

// ─────────────────────────────────────────────────────────────────────────────
//  1. GET USER NOTIFICATIONS  (paginated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/notifications
 * @desc    Fetch the requesting user's notifications, newest first.
 *          Supports optional ?unreadOnly=true filter.
 *          Paginated: default page=1, limit=20 (max 50).
 * @access  Private
 */
router.get(
    '/',
    protect,
    asyncHandler(async (req, res) => {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const filter = { recipient: req.user._id };
        if (req.query.unreadOnly === 'true') filter.isRead = false;

        const total         = await Notification.countDocuments(filter);
        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.status(200).json({
            success:    true,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data:       notifications,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  2. GET UNREAD COUNT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Returns the number of unread notifications for the user.
 *          Uses the { recipient, isRead, createdAt } compound index — O(1) count.
 *          Intended for notification-badge rendering on the frontend.
 * @access  Private
 */
router.get(
    '/unread-count',
    protect,
    asyncHandler(async (req, res) => {
        const count = await Notification.countDocuments({
            recipient: req.user._id,
            isRead:    false,
        });

        res.status(200).json({ success: true, unreadCount: count });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  3. MARK ALL AS READ
//
//  FIX: Must be declared BEFORE  PATCH /:id/read.
//  Express matches top-to-bottom; if /:id/read comes first, the literal
//  string "read-all" is captured as :id and this route is never reached.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark every unread notification for the requesting user as read.
 * @access  Private
 */
router.patch(
    '/read-all',
    protect,
    asyncHandler(async (req, res) => {
        const result = await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );

        res.status(200).json({
            success:  true,
            message:  'All notifications marked as read.',
            modified: result.modifiedCount,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  4. MARK SINGLE NOTIFICATION AS READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark a single notification as read. Ownership-checked.
 * @access  Private
 */
router.patch(
    '/:id/read',
    protect,
    [param('id').isMongoId().withMessage('Invalid notification id')],
    validate,
    asyncHandler(async (req, res) => {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { $set: { isRead: true, readAt: new Date() } },
            { new: true }
        );

        if (!notification)
            return res.status(404).json({ success: false, message: 'Notification not found.' });

        res.status(200).json({ success: true, data: notification });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  5. CREATE / SEND NOTIFICATION  (admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/notifications/send
 * @desc    Admin creates and sends a notification to a specific recipient.
 *
 *          FIX 1: `actionData` replaced with the correct model fields:
 *            - deepLink  { screen, referenceId }  — in-app navigation target
 *            - actionUrl string                   — fallback web URL
 *          FIX 2: SOS_Alert type forces priority to 'Critical' regardless of
 *            what the caller passes — SOS is always a Critical-level event.
 *          FIX 3: triggeredBy set to 'admin' and createdBy set to req.user._id
 *            so the audit trail is preserved.
 *
 * @access  Private (admin, superadmin)
 */
router.post(
    '/send',
    protect,
    authorize('admin', 'superadmin'),
    [
        body('recipient').isMongoId().withMessage('recipient must be a valid Mongo ID'),
        body('title').trim().notEmpty().withMessage('title is required'),
        body('body').trim().notEmpty().withMessage('body is required'),
        body('type').notEmpty().withMessage('type is required'),
        body('priority')
            .optional()
            .isIn(['Critical', 'High', 'Medium', 'Normal', 'Low'])
            .withMessage('Invalid priority value'),
        body('deepLink').optional().isObject(),
        body('actionUrl').optional().isURL().withMessage('actionUrl must be a valid URL'),
        body('relatedEntityType')
            .optional()
            .isIn(['Booking', 'PharmacyOrder', 'UserSubscription', 'User', 'LabReport'])
            .withMessage('Invalid relatedEntityType'),
        body('relatedEntityId').optional().isMongoId(),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const {
            recipient,
            title,
            body: notifBody,  // renamed to avoid shadowing the outer `body` import
            type,
            priority,
            deepLink,
            actionUrl,
            relatedEntityType,
            relatedEntityId,
            imageUrl,
        } = req.body;

        // FIX: SOS_Alert is always Critical — override whatever was passed
        const resolvedPriority =
            type === 'SOS_Alert'
                ? 'Critical'
                : (priority || 'Medium');

        const notification = await Notification.create({
            recipient,
            title,
            body:        notifBody,
            type,
            priority:    resolvedPriority,
            deepLink,            // FIX: correct field name (was: actionData)
            actionUrl,           // FIX: correct field name (was: not present)
            imageUrl,
            relatedEntityType:   relatedEntityType || null,
            relatedEntityId:     relatedEntityId   || null,
            triggeredBy:         'admin',           // FIX: was defaulting to 'system'
            createdBy:           req.user._id,      // FIX: audit trail
        });

        // TODO: trigger real-time delivery here (e.g. Socket.io / Firebase FCM)

        res.status(201).json({ success: true, data: notification });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  6. DELETE A SINGLE NOTIFICATION  (soft: marks expired)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Customer dismisses a notification (sets expiresAt = now so the
 *          TTL index cleans it up). Ownership-checked.
 * @access  Private
 */
router.delete(
    '/:id',
    protect,
    [param('id').isMongoId().withMessage('Invalid notification id')],
    validate,
    asyncHandler(async (req, res) => {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { $set: { expiresAt: new Date() } },
            { new: true }
        );

        if (!notification)
            return res.status(404).json({ success: false, message: 'Notification not found.' });

        res.status(200).json({ success: true, message: 'Notification dismissed.' });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL ERROR HANDLER  (must be last)
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
    console.error('[NotificationRouter Error]', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error.',
    });
});

export default router;