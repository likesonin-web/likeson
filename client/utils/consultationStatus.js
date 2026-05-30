/**
 * consultationStatus.js
 * Status helpers for consultation lifecycle
 */

export const STATUS = {
  CREATED: 'created',
  SCHEDULED: 'scheduled',
  WAITING: 'waiting',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

export const TERMINAL_STATUSES = new Set([
  STATUS.COMPLETED,
  STATUS.CANCELLED,
  STATUS.FAILED,
  STATUS.EXPIRED,
]);

export const PRE_ROOM_STATUSES = new Set([
  STATUS.CREATED,
  STATUS.SCHEDULED,
]);

export const ACTIVE_STATUSES = new Set([
  STATUS.WAITING,
  STATUS.ACTIVE,
  STATUS.PAUSED,
]);

export const isTerminal = (status) => TERMINAL_STATUSES.has(status);
export const isPreRoom = (status) => PRE_ROOM_STATUSES.has(status);
export const isInRoom = (status) => ACTIVE_STATUSES.has(status);
export const isLive = (status) => status === STATUS.ACTIVE;
export const isPaused = (status) => status === STATUS.PAUSED;
export const isCompleted = (status) => status === STATUS.COMPLETED;
export const isCancelled = (status) => status === STATUS.CANCELLED;
export const isWaiting = (status) => status === STATUS.WAITING;

export const getStatusLabel = (status) => {
  switch (status) {
    case STATUS.CREATED:   return 'Scheduled';
    case STATUS.SCHEDULED: return 'Confirmed';
    case STATUS.WAITING:   return 'Waiting';
    case STATUS.ACTIVE:    return 'Live';
    case STATUS.PAUSED:    return 'Paused';
    case STATUS.COMPLETED: return 'Completed';
    case STATUS.CANCELLED: return 'Cancelled';
    case STATUS.FAILED:    return 'Failed';
    case STATUS.EXPIRED:   return 'Expired';
    default: return status ?? 'Unknown';
  }
};

export const getStatusBadgeClass = (status) => {
  switch (status) {
    case STATUS.ACTIVE:    return 'badge-success badge-live';
    case STATUS.WAITING:   return 'badge-warning';
    case STATUS.PAUSED:    return 'badge-warning';
    case STATUS.COMPLETED: return 'badge-success';
    case STATUS.CANCELLED: return 'badge-error';
    case STATUS.FAILED:    return 'badge-error';
    case STATUS.EXPIRED:   return 'badge-error';
    case STATUS.CREATED:
    case STATUS.SCHEDULED: return 'badge-info';
    default: return 'badge-secondary';
  }
};

/**
 * Given a status, return where a patient should be routed
 */
export const getPatientRoute = (status, consultationId, bookingId) => {
  if (isPreRoom(status)) return `/waiting-room/${consultationId}`;
  if (isInRoom(status))  return `/consultation/room/${consultationId}`;
  if (isTerminal(status)) return null; // show summary
  return null;
};

/**
 * Given a status, return where a doctor should be routed
 */
export const getDoctorRoute = (status, consultationId, bookingId) => {
  if (isPreRoom(status)) return null; // show ready screen
  if (isInRoom(status))  return `/doctor/consultation/room/${consultationId}`;
  if (isTerminal(status)) return null; // show summary
  return null;
};
