 
import pushService   from './pushservice.js';
import pushTemplates from '../utils/pushTemplates.js';

// ─── Safe dispatch wrapper ────────────────────────────────────────────────────

/**
 * Wraps every push call so a OneSignal failure never bubbles into the caller.
 * Push notifications are non-critical — failure is logged, never thrown.
 */
const safeDispatch = async (fn, tag) => {
  try {
    const result = await fn();
    return result ?? {};
  } catch (err) {
    console.error('[notificationDispatcher] Push failed — non-critical, continuing.', {
      tag,
      message: err.message,
      status:  err.status,
    });
    return { skipped: true };
  }
};

/**
 * Guard: throws a clear error if required fields are missing.
 */
const requireFields = (data, fields, tag) => {
  const missing = fields.filter((f) => data[f] == null || data[f] === '');
  if (missing.length > 0) {
    throw new Error(
      `[notificationDispatcher][${tag}] Missing required fields: ${missing.join(', ')}`
    );
  }
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  welcome: (user) => {
    requireFields(user, ['userId', 'name'], 'auth.welcome');
    return safeDispatch(
      () => pushService.sendToUser(user.userId, pushTemplates.auth.welcome(user)),
      'auth.welcome'
    );
  },

  verifyReminder: (user) => {
    requireFields(user, ['userId', 'name'], 'auth.verifyReminder');
    return safeDispatch(
      () => pushService.sendToUser(user.userId, pushTemplates.auth.verifyReminder(user)),
      'auth.verifyReminder'
    );
  },

  passwordChanged: (user) => {
    requireFields(user, ['userId', 'name'], 'auth.passwordChanged');
    return safeDispatch(
      () => pushService.sendToUser(user.userId, pushTemplates.auth.passwordChanged(user)),
      'auth.passwordChanged'
    );
  },
};

// ─── Booking ──────────────────────────────────────────────────────────────────

export const booking = {
  confirmed: (data) => {
    requireFields(data, ['userId', 'name', 'service', 'bookingId', 'date'], 'booking.confirmed');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.booking.confirmed(data)),
      'booking.confirmed'
    );
  },

  reminder: (data) => {
    requireFields(data, ['userId', 'name', 'service', 'bookingId', 'eta', 'sendAt'], 'booking.reminder');
    return safeDispatch(
      () => pushService.sendScheduled(data.userId, pushTemplates.booking.reminder(data), data.sendAt),
      'booking.reminder'
    );
  },

  cancelled: (data) => {
    requireFields(data, ['userId', 'name', 'service', 'bookingId', 'reason'], 'booking.cancelled');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.booking.cancelled(data)),
      'booking.cancelled'
    );
  },

  completed: (data) => {
    requireFields(data, ['userId', 'name', 'service', 'bookingId'], 'booking.completed');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.booking.completed(data)),
      'booking.completed'
    );
  },
};

// ─── Ambulance ────────────────────────────────────────────────────────────────

export const ambulance = {
  dispatched: (data) => {
    requireFields(data, ['userId', 'driverName', 'vehicleNo', 'eta', 'bookingId'], 'ambulance.dispatched');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.ambulance.dispatched(data)),
      'ambulance.dispatched'
    );
  },

  arrived: (data) => {
    requireFields(data, ['userId', 'bookingId'], 'ambulance.arrived');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.ambulance.arrived(data)),
      'ambulance.arrived'
    );
  },

  newJobAlert: (driverUserIds, jobData) => {
    if (!Array.isArray(driverUserIds) || driverUserIds.length === 0) {
      throw new Error(
        '[notificationDispatcher][ambulance.newJobAlert] driverUserIds must be a non-empty array'
      );
    }
    requireFields(jobData, ['location', 'jobId'], 'ambulance.newJobAlert');
    return safeDispatch(
      () => pushService.sendToUsers(driverUserIds, pushTemplates.ambulance.newJobAlert(jobData)),
      'ambulance.newJobAlert'
    );
  },
};

// ─── Care ─────────────────────────────────────────────────────────────────────

export const care = {
  caregiverAssigned: (data) => {
    requireFields(data, ['userId', 'name', 'caregiverName', 'service', 'bookingId'], 'care.caregiverAssigned');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.care.caregiverAssigned(data)),
      'care.caregiverAssigned'
    );
  },

  enRoute: (data) => {
    requireFields(data, ['userId', 'caregiverName', 'eta', 'bookingId'], 'care.enRoute');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.care.enRoute(data)),
      'care.enRoute'
    );
  },

  medicationReminder: (data) => {
    requireFields(data, ['userId', 'name', 'medicationName', 'time'], 'care.medicationReminder');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.care.medicationReminder(data)),
      'care.medicationReminder'
    );
  },
};

// ─── Billing ──────────────────────────────────────────────────────────────────

export const billing = {
  paymentSuccess: (data) => {
    requireFields(data, ['userId', 'name', 'amount', 'invoiceId'], 'billing.paymentSuccess');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.billing.paymentSuccess(data)),
      'billing.paymentSuccess'
    );
  },

  paymentFailed: (data) => {
    requireFields(data, ['userId', 'name', 'amount', 'invoiceId'], 'billing.paymentFailed');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.billing.paymentFailed(data)),
      'billing.paymentFailed'
    );
  },

  invoiceReady: (data) => {
    requireFields(data, ['userId', 'amount', 'invoiceId'], 'billing.invoiceReady');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.billing.invoiceReady(data)),
      'billing.invoiceReady'
    );
  },
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const admin = {
  accountSuspended: (data) => {
    requireFields(data, ['userId', 'name', 'reason'], 'admin.accountSuspended');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.admin.accountSuspended(data)),
      'admin.accountSuspended'
    );
  },

  roleChanged: (data) => {
    requireFields(data, ['userId', 'name', 'newRole'], 'admin.roleChanged');
    return safeDispatch(
      () => pushService.sendToUser(data.userId, pushTemplates.admin.roleChanged(data)),
      'admin.roleChanged'
    );
  },

  /**
   * FIX: `sendToAll` accepts only (templatePayload).
   * When excludeSegments is provided, route through sendToSegment.
   */
  broadcast: (data, excludeSegments = []) => {
    requireFields(data, ['title', 'body'], 'admin.broadcast');

    if (excludeSegments.length > 0) {
      return safeDispatch(
        () => pushService.sendToSegment('All', pushTemplates.admin.broadcast(data), excludeSegments),
        'admin.broadcast'
      );
    }

    return safeDispatch(
      () => pushService.sendToAll(pushTemplates.admin.broadcast(data)),
      'admin.broadcast'
    );
  },
};

export default { auth, booking, ambulance, care, billing, admin };