// services/consultationStatus.js
// Status machine — valid transitions, guards, and side-effect hooks.
// Imported by consultation.service.js AND consultationSocket.js (no duplication).

// ── Transition map ────────────────────────────────────────────────────────────

export const STATUS_TRANSITIONS = {
  scheduled:        ['waiting', 'doctor_joined', 'patient_joined', 'cancelled', 'missed'],
  waiting:          ['doctor_joined', 'in_progress', 'cancelled', 'no_show_patient'],
  doctor_joined:    ['in_progress', 'patient_joined', 'missed', 'no_show_patient', 'cancelled'],
  patient_joined:   ['in_progress', 'doctor_joined', 'missed', 'no_show_doctor', 'cancelled'],
  in_progress:      ['paused', 'completed', 'technical_failure'],
  paused:           ['in_progress', 'completed', 'technical_failure'],
  completed:        [],   // terminal
  missed:           [],   // terminal
  cancelled:        [],   // terminal
  no_show_patient:  [],   // terminal
  no_show_doctor:   [],   // terminal
  technical_failure:['scheduled', 'cancelled'],  // can reschedule
};

// ── Role-based transition guards ──────────────────────────────────────────────
// Which roles can trigger which transitions

export const TRANSITION_GUARDS = {
  waiting:           ['customer', 'doctor', 'admin', 'superadmin'],  // patient enters waiting room
  doctor_joined:     ['doctor',   'admin', 'superadmin'],
  patient_joined:    ['customer', 'admin', 'superadmin'],
  in_progress:       ['doctor',   'customer', 'admin', 'superadmin'],
  paused:            ['doctor',   'customer', 'admin', 'superadmin'],
  completed:         ['doctor',   'admin', 'superadmin'],
  cancelled:         ['doctor',   'customer', 'admin', 'superadmin'],
  missed:            ['admin',    'superadmin', null],               // system/cron only
  no_show_patient:   ['doctor',   'admin', 'superadmin'],
  no_show_doctor:    ['customer', 'admin', 'superadmin'],
  technical_failure: ['doctor',   'customer', 'admin', 'superadmin'],
};

// ── Terminal statuses ─────────────────────────────────────────────────────────

export const TERMINAL_STATUSES = new Set([
  'completed', 'missed', 'cancelled', 'no_show_patient', 'no_show_doctor',
]);

// ── Active statuses (session in flight) ───────────────────────────────────────

export const ACTIVE_STATUSES = new Set([
  'waiting', 'doctor_joined', 'patient_joined', 'in_progress', 'paused',
]);

// ── Joinable statuses (can provision/get tokens) ──────────────────────────────

export const JOINABLE_STATUSES = new Set([
  'scheduled', 'waiting', 'doctor_joined', 'patient_joined', 'in_progress', 'paused',
]);

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * assertCanTransition
 * Throws if the from → to transition is not allowed.
 */
export const assertCanTransition = (from, to) => {
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed) throw new Error(`Unknown status: ${from}`);
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: "${from}" → "${to}". Allowed: [${allowed.join(', ')}]`
    );
  }
};

/**
 * assertRoleCanTransition
 * Throws if the user's role is not allowed to trigger the transition.
 * Pass null for system/cron-triggered transitions.
 */
export const assertRoleCanTransition = (toStatus, userRole) => {
  const allowed = TRANSITION_GUARDS[toStatus];
  if (!allowed) return; // no guard defined — allow
  if (!allowed.includes(userRole)) {
    throw new Error(
      `Role "${userRole}" cannot trigger transition to "${toStatus}"`
    );
  }
};

/**
 * assertNotTerminal
 * Throws if the consultation is already in a terminal state.
 */
export const assertNotTerminal = (status) => {
  if (TERMINAL_STATUSES.has(status)) {
    throw new Error(`Consultation is already in terminal status: "${status}"`);
  }
};

/**
 * assertJoinable
 * Throws if tokens cannot be issued for this status.
 */
export const assertJoinable = (status) => {
  if (!JOINABLE_STATUSES.has(status)) {
    throw new Error(`Cannot join consultation in status: "${status}"`);
  }
};

// ── Auto-transition logic ─────────────────────────────────────────────────────

/**
 * resolveJoinTransition
 * Given current status and joining role, returns the next status.
 * Returns null if no transition is needed.
 *
 * @param {string} currentStatus
 * @param {'doctor'|'patient'} joiningRole
 * @returns {string|null}
 */
export const resolveJoinTransition = (currentStatus, joiningRole) => {
  const isDoctor  = joiningRole === 'doctor';
  const isPatient = joiningRole === 'patient';

  if (isDoctor) {
    if (currentStatus === 'scheduled')      return 'doctor_joined';
    if (currentStatus === 'patient_joined') return 'in_progress';
    if (currentStatus === 'waiting')        return 'doctor_joined';
  }

  if (isPatient) {
    if (currentStatus === 'scheduled')     return 'patient_joined';
    if (currentStatus === 'doctor_joined') return 'in_progress';
    if (currentStatus === 'waiting')       return 'in_progress';
  }

  return null; // no transition needed (e.g. rejoining in_progress)
};

/**
 * resolveLeaveTransition
 * When a participant leaves, determine if status should change.
 * (Usually handled at 'end' route — leave events are tracking only)
 *
 * @param {string} currentStatus
 * @param {'doctor'|'patient'} leavingRole
 * @returns {string|null}
 */
export const resolveLeaveTransition = (currentStatus, leavingRole) => {
  // If in_progress and doctor leaves → paused (patient still there)
  if (currentStatus === 'in_progress' && leavingRole === 'doctor') return 'paused';
  // If both leave (patient leaves) → paused
  if (currentStatus === 'in_progress' && leavingRole === 'patient') return 'paused';
  return null;
};

// ── Socket event → status map ─────────────────────────────────────────────────

/**
 * Maps socket event names to status transitions.
 * Used by consultationSocket.js to validate incoming events.
 */
export const SOCKET_EVENT_STATUS_MAP = {
  'consultation:join':             null,       // resolveJoinTransition handles this
  'consultation:leave':            null,       // resolveLeaveTransition handles this
  'consultation:start':            'in_progress',
  'consultation:end':              'completed',
  'consultation:pause':            'paused',
  'consultation:resume':           'in_progress',
  'consultation:cancel':           'cancelled',
  'consultation:technical-fail':   'technical_failure',
  'consultation:waiting-enter':    'waiting',
};

// ── Status display metadata (for frontend) ────────────────────────────────────

export const STATUS_META = {
  scheduled:        { label: 'Scheduled',          color: '#3B82F6', icon: '📅' },
  waiting:          { label: 'In Waiting Room',     color: '#F59E0B', icon: '⏳' },
  doctor_joined:    { label: 'Doctor Ready',        color: '#8B5CF6', icon: '👨‍⚕️' },
  patient_joined:   { label: 'Patient Ready',       color: '#8B5CF6', icon: '🧑' },
  in_progress:      { label: 'In Progress',         color: '#10B981', icon: '🔴' },
  paused:           { label: 'Paused',              color: '#6B7280', icon: '⏸️' },
  completed:        { label: 'Completed',           color: '#059669', icon: '✅' },
  missed:           { label: 'Missed',              color: '#EF4444', icon: '❌' },
  cancelled:        { label: 'Cancelled',           color: '#DC2626', icon: '🚫' },
  no_show_patient:  { label: 'Patient No-Show',     color: '#EF4444', icon: '👤❌' },
  no_show_doctor:   { label: 'Doctor No-Show',      color: '#EF4444', icon: '👨‍⚕️❌' },
  technical_failure:{ label: 'Technical Failure',   color: '#B45309', icon: '⚠️' },
};