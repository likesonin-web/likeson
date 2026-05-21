/**
 * constants.js — DoctorOnlineConsultation
 * Likeson.in telemedicine platform
 */

export const CONSULTATION_STATUS = {
  CREATED:              'created',
  WAITING_FOR_DOCTOR:   'waiting_for_doctor',
  WAITING_FOR_PATIENT:  'waiting_for_patient',
  LIVE:                 'live',
  PAUSED:               'paused',
  COMPLETED:            'completed',
  CANCELLED:            'cancelled',
  EXPIRED:              'expired',
  FAILED:               'failed',
};

export const BOOKING_STATUS = {
  CONFIRMED:   'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  CANCELLED:   'cancelled',
};

export const NETWORK_QUALITY = {
  EXCELLENT:    'excellent',
  GOOD:         'good',
  POOR:         'poor',
  DISCONNECTED: 'disconnected',
};

/** Timer warning thresholds in minutes */
export const TIMER_WARNINGS = [10, 5, 1];

/** Side panel tabs */
export const PANEL_TABS = {
  CHAT:         'chat',
  PARTICIPANTS: 'participants',
  WAITING:      'waiting',
  NOTES:        'notes',
};

/** Sidebar tabs */
export const SIDEBAR_TABS = {
  PATIENT:      'patient',
  PRESCRIPTION: 'prescription',
  HISTORY:      'history',
};

export const NETWORK_LOG_INTERVAL_MS = 15_000;
export const RECONNECT_DEBOUNCE_MS   = 3_000;
export const TIMER_TICK_MS           = 1_000;

/** VideoSDK participant roles */
export const VIDEOSDK_ROLE = {
  HOST:        'host',
  PARTICIPANT: 'participant',
};