/**
 * consultation.constants.js
 * Single source of truth for all consultation-related constants.
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

export const NETWORK_QUALITY_CONFIG = {
  excellent:    { label: 'Excellent',     color: '#10b981', bars: 4 },
  good:         { label: 'Good',          color: '#3b82f6', bars: 3 },
  poor:         { label: 'Poor',          color: '#f59e0b', bars: 2 },
  disconnected: { label: 'Disconnected',  color: '#ef4444', bars: 0 },
};

/** VideoSDK meeting states */
export const MEETING_STATE = {
  IDLE:         'IDLE',
  CONNECTING:   'CONNECTING',
  CONNECTED:    'CONNECTED',
  FAILED:       'FAILED',
  CLOSED:       'CLOSED',
};

/** How often to log network quality (ms) */
export const NETWORK_LOG_INTERVAL_MS = 30_000;

/** Reconnect throttle: don't attempt more than once per N ms */
export const RECONNECT_THROTTLE_MS = 5_000;

/** Max reconnect attempts before showing hard error */
export const MAX_RECONNECT_ATTEMPTS = 5;

/** Session warning threshold (seconds before allowedDuration) */
export const SESSION_WARNING_SECS = 120;

/** Consent items shown in modal */
export const CONSENT_ITEMS = [
  {
    id: 'disclaimer',
    title: 'Online Consultation Disclaimer',
    body: 'This online consultation is not a substitute for an in-person visit. Physical examination is not possible via video. Your doctor will advise if an in-person visit is required.',
  },
  {
    id: 'emergency',
    title: 'Emergency Warning',
    body: 'Do NOT use this platform for medical emergencies. In case of emergency, call 108 (Ambulance) or visit the nearest hospital immediately.',
  },
  {
    id: 'privacy',
    title: 'Privacy & Recording',
    body: 'Your consultation may be recorded for quality and safety purposes. All data is encrypted and stored securely per our Privacy Policy. The recording is accessible only to authorised medical staff.',
  },
  {
    id: 'prescription',
    title: 'Prescription Disclaimer',
    body: 'Prescriptions issued during online consultations are subject to the doctor\'s clinical judgment. Not all medications can be prescribed online. Always follow up with your doctor if symptoms worsen.',
  },
  {
    id: 'network',
    title: 'Network Disclaimer',
    body: 'A stable internet connection (minimum 1 Mbps) is required. Likeson.in is not responsible for consultation interruptions caused by poor connectivity on your end.',
  },
  {
    id: 'limitation',
    title: 'Medical Limitation Notice',
    body: 'Online consultations have inherent limitations. Certain conditions require physical tests, imaging, or lab work. Your doctor may refer you for further investigation.',
  },
];

export const CONSULTATION_PHASES = {
  LOADING:     'loading',
  ERROR:       'error',
  DENIED:      'denied',
  CONSENT:     'consent',
  PERMISSIONS: 'permissions',
  LOBBY:       'lobby',
  WAITING:     'waiting',
  LIVE:        'live',
  COMPLETED:   'completed',
};