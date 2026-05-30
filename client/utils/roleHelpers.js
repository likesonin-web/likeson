/**
 * roleHelpers.js
 * Role-based permission utilities for consultation room
 */

export const ROLES = {
  DOCTOR: 'doctor',
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
  CARE_ASSISTANT: 'care_assistant',
};

/**
 * Check if role is doctor
 */
export const isDoctor = (role) => role === ROLES.DOCTOR;

/**
 * Check if role is patient/customer
 */
export const isPatient = (role) => role === ROLES.CUSTOMER;

/**
 * Check if role is admin
 */
export const isAdmin = (role) => [ROLES.ADMIN, ROLES.SUPERADMIN].includes(role);

/**
 * Check if role is a host (can mute/kick)
 */
export const isHost = (role) => isDoctor(role) || isAdmin(role);

/**
 * Can the role prescribe medicines?
 */
export const canPrescribe = (role) => isDoctor(role);

/**
 * Can the role see the waiting room panel?
 */
export const canSeeWaitingRoom = (role) => isHost(role);

/**
 * Can the role admit/reject patients from waiting room?
 */
export const canAdmitPatients = (role) => isHost(role);

/**
 * Can the role mute other participants?
 */
export const canMuteOthers = (role) => isHost(role);

/**
 * Can the role kick participants?
 */
export const canKickParticipants = (role) => isHost(role);

/**
 * Can the role end the consultation (not just leave)?
 */
export const canEndConsultation = (role) => isHost(role);

/**
 * Can the role raise hand?
 */
export const canRaiseHand = (role) => isPatient(role);

/**
 * Can the role see doctor notes?
 */
export const canSeeDoctorNotes = (role) => isDoctor(role) || isAdmin(role);

/**
 * Can the role start the consultation?
 */
export const canStartConsultation = (role) => isHost(role);

/**
 * Get display label for role
 */
export const getRoleLabel = (role) => {
  switch (role) {
    case ROLES.DOCTOR: return 'Doctor';
    case ROLES.CUSTOMER: return 'Patient';
    case ROLES.ADMIN: return 'Admin';
    case ROLES.SUPERADMIN: return 'Super Admin';
    case ROLES.CARE_ASSISTANT: return 'Care Assistant';
    default: return 'Participant';
  }
};

/**
 * Get route prefix for role
 */
export const getRoutePrefix = (role) => {
  if (isDoctor(role) || isAdmin(role)) return '/doctor/consultation';
  return '/consultation';
};

/**
 * Get correct room route for role
 */
export const getRoomRoute = (role, consultationId) => {
  if (isDoctor(role) || isAdmin(role)) {
    return `/doctor/consultation/room/${consultationId}`;
  }
  return `/consultation/room/${consultationId}`;
};

/**
 * Get correct booking entry route for role
 */
export const getBookingRoute = (role, bookingId) => {
  if (isDoctor(role) || isAdmin(role)) {
    return `/doctor/consultation/${bookingId}`;
  }
  return `/consultation/${bookingId}`;
};
