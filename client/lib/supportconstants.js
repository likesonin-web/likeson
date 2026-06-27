/**
 * lib/supportconstants.js
 *
 * Single source of truth for every enum the Support module uses on the
 * frontend. These mirror `models/ticket.model.js` and `models/User.js`
 * on the backend EXACTLY — do not rename a value here without renaming it
 * on the server, or filters / badges will silently stop matching records.
 */

// ─── Ticket Enums (from models/ticket.model.js) ──────────────────────────────

export const TICKET_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'WAITING_FOR_PARTNER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const TICKET_DEPARTMENTS = [
  'GENERAL_SUPPORT',
  'FINANCE',
  'KYC_VERIFICATION',
  'TECHNICAL_SUPPORT',
  'PARTNER_OPERATIONS',
  'COMPLAINTS',
  'BILLING',
  'SUBSCRIPTIONS',
  'REFUNDS',
  'ACCOUNT_SECURITY',
];

export const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'FILE', 'SYSTEM', 'INTERNAL_NOTE', 'MENTION', 'ATTACHMENT'];

export const SLA_HOURS = { LOW: 48, MEDIUM: 24, HIGH: 6, CRITICAL: 2 };

// ─── Role Enums (from models/User.js) ────────────────────────────────────────

export const CUSTOMER_ROLE = 'customer';

export const PARTNER_ROLES = [
  'doctor',
  'hospital',
  'transportpartner',
  'driver',
  'solodriverpartner',
  'pharmacy',
  'care_assistant',
  'lab_partner',
  'blood_bank',
];

export const ADMIN_ROLES = ['admin', 'superadmin', 'finance'];

export const ALL_AGENT_ROLES = ['admin', 'superadmin', 'finance']; // assignable agents

// ─── Display Labels ───────────────────────────────────────────────────────────

export const STATUS_LABELS = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_CUSTOMER: 'Waiting on Customer',
  WAITING_FOR_PARTNER: 'Waiting on Partner',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

/** Maps a ticket status to a badge-* utility class from global.css */
export const STATUS_BADGE = {
  OPEN: 'badge-info',
  ASSIGNED: 'badge-primary',
  IN_PROGRESS: 'badge-primary',
  WAITING_FOR_CUSTOMER: 'badge-warning',
  WAITING_FOR_PARTNER: 'badge-warning',
  ESCALATED: 'badge-error',
  RESOLVED: 'badge-success',
  CLOSED: 'badge-secondary',
  REOPENED: 'badge-warning',
};

export const PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const PRIORITY_BADGE = {
  LOW: 'badge-info',
  MEDIUM: 'badge-primary',
  HIGH: 'badge-warning',
  CRITICAL: 'badge-error',
};

export const DEPARTMENT_LABELS = {
  GENERAL_SUPPORT: 'General Support',
  FINANCE: 'Finance',
  KYC_VERIFICATION: 'KYC Verification',
  TECHNICAL_SUPPORT: 'Technical Support',
  PARTNER_OPERATIONS: 'Partner Operations',
  COMPLAINTS: 'Complaints',
  BILLING: 'Billing',
  SUBSCRIPTIONS: 'Subscriptions',
  REFUNDS: 'Refunds',
  ACCOUNT_SECURITY: 'Account Security',
};

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  doctor: 'Doctor',
  hospital: 'Hospital',
  transportpartner: 'Transport Partner',
  driver: 'Driver',
  solodriverpartner: 'Solo Driver Partner',
  customer: 'Customer',
  pharmacy: 'Pharmacy',
  care_assistant: 'Care Assistant',
  lab_partner: 'Lab Partner',
  blood_bank: 'Blood Bank',
};

// ─── Mention triggers (admin-side roles only, per spec) ──────────────────────

export const MENTIONABLE_ROLE_TAGS = ['admin', 'superadmin', 'finance'];

// ─── Upload constraints (mirrors routes/support/upload.routes.js) ───────────

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
];

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ─── Misc UI constants ────────────────────────────────────────────────────────

export const MESSAGE_MAX_LENGTH = 5000;
export const TYPING_DEBOUNCE_MS = 1200;
export const SOCKET_NAMESPACE = '/support';
export const HEARTBEAT_INTERVAL_MS = 25000;

/** Helper — is this ticket past its SLA deadline and not yet resolved/closed? */
export function isSlaBreached(ticket) {
  if (!ticket?.slaDeadline) return false;
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) return false;
  return new Date(ticket.slaDeadline).getTime() < Date.now();
}

/** Helper — minutes remaining until SLA deadline (negative = breached) */
export function slaMinutesRemaining(ticket) {
  if (!ticket?.slaDeadline) return null;
  return Math.round((new Date(ticket.slaDeadline).getTime() - Date.now()) / 60000);
}
