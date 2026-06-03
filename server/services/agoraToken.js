//agoraToken.js// services/agoraToken.js
// DB-aware service — reads/writes Consultation model.
// Handles: initial token generation, refresh, webhook verification.

import crypto from 'crypto';
import Consultation from '../models/Consultation.js';
import agoraConfig   from '../config/agora.config.js';
import {
  generateParticipantTokens,
  generateRtcToken,
  generateRtmToken,
} from '../utils/generateAgoraToken.js';

// ── UID assignment ────────────────────────────────────────────────────────────
// Agora UIDs must be uint32 (1 – 4294967295). We assign fixed ranges per role.
// Avoids collision within a channel.

const UID_RANGES = {
  doctor:      { min: 1000, max: 1999 },
  patient:     { min: 2000, max: 2999 },
  interpreter: { min: 3000, max: 3999 },
  observer:    { min: 4000, max: 4999 },
  caregiver:   { min: 5000, max: 5999 },
};

const randomUid = (role) => {
  const range = UID_RANGES[role] || { min: 6000, max: 9999 };
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
};

// ── 1. Provision tokens for a new consultation ────────────────────────────────

/**
 * Called once when consultation is created / first join attempted.
 * Generates doctor + patient RTC + RTM tokens, writes to consultation.agora.
 *
 * @param {string} consultationId  - Consultation._id
 * @param {string} doctorUserId    - User._id of doctor
 * @param {string} patientUserId   - User._id of patient
 * @param {string} updatedBy       - actor _id (for audit)
 *
 * @returns {object}  { doctorTokens, patientTokens, channelName, appId, expiresAt }
 */
export async function provisionConsultationTokens(
  consultationId,
  doctorUserId,
  patientUserId,
  updatedBy,
) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw new Error('Consultation not found');

  // Only video/audio consultations need Agora tokens
  if (!['video', 'audio'].includes(consultation.consultationType)) {
    throw new Error(`consultationType '${consultation.consultationType}' does not use Agora`);
  }

  const channelName = consultation.agora?.channelName
    || `consult_${consultation._id.toString()}`;

  const rtmChannel  = consultation.agora?.rtmChannelName
    || `rtm_${consultation._id.toString()}`;

  // Assign UIDs (or reuse if already set)
  const doctorUid  = consultation.agora?.doctorUid  || randomUid('doctor');
  const patientUid = consultation.agora?.patientUid || randomUid('patient');

  // Generate tokens
  const doctorTokens  = generateParticipantTokens({
    channelName,
    uid:    doctorUid,
    userId: doctorUserId,
    role:   'publisher',
  });

  const patientTokens = generateParticipantTokens({
    channelName,
    uid:    patientUid,
    userId: patientUserId,
    role:   'publisher',
  });

  // Persist to DB (select: false fields written explicitly)
  consultation.agora = {
    ...consultation.agora,
    channelName,
    appId:           agoraConfig.appId,
    rtmChannelName:  rtmChannel,

    doctorUid,
    doctorRtcToken:  doctorTokens.rtcToken,
    doctorRtmToken:  doctorTokens.rtmToken,

    patientUid,
    patientRtcToken: patientTokens.rtcToken,
    patientRtmToken: patientTokens.rtmToken,

    tokenExpiresAt:       doctorTokens.expiresAt,
    tokenRefreshCount:    (consultation.agora?.tokenRefreshCount || 0),

    isRecordingEnabled:   consultation.agora?.isRecordingEnabled  ?? false,
    recordingConsentDoctor:  consultation.agora?.recordingConsentDoctor  ?? false,
    recordingConsentPatient: consultation.agora?.recordingConsentPatient ?? false,
  };

  consultation.updatedBy = updatedBy;
  await consultation.save();

  return {
    appId:       agoraConfig.appId,
    channelName,
    rtmChannelName: rtmChannel,
    expiresAt:   doctorTokens.expiresAt,
    tokenExpireSec: agoraConfig.tokenExpireSec,
    doctorTokens: {
      uid:      doctorUid,
      rtcToken: doctorTokens.rtcToken,
      rtmToken: doctorTokens.rtmToken,
    },
    patientTokens: {
      uid:      patientUid,
      rtcToken: patientTokens.rtcToken,
      rtmToken: patientTokens.rtmToken,
    },
  };
}

// ── 2. Get tokens for a specific participant (join / rejoin) ──────────────────

/**
 * Returns existing tokens for doctor or patient.
 * If tokens are expired / missing, auto-refreshes first.
 *
 * @param {string} consultationId
 * @param {'doctor'|'patient'} participantRole
 * @param {string} userId   - User._id of the caller (for security check)
 *
 * @returns {{ uid, rtcToken, rtmToken, channelName, rtmChannelName, appId, expiresAt }}
 */
export async function getParticipantTokens(consultationId, participantRole, userId) {
  let consultation = await Consultation.findById(consultationId)
    .select('+agora.doctorRtcToken +agora.doctorRtmToken +agora.patientRtcToken +agora.patientRtmToken');

  if (!consultation) throw new Error('Consultation not found');

  if (!consultation.agora?.channelName) {
    throw new Error('Agora session not provisioned yet. Call provisionConsultationTokens first.');
  }

  // Auto-refresh if expired or expiring within 5 min
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  const needsRefresh   = !consultation.agora.tokenExpiresAt
    || consultation.agora.tokenExpiresAt < fiveMinFromNow;

  if (needsRefresh) {
    await refreshConsultationTokens(consultationId, userId);
    consultation = await Consultation.findById(consultationId)
      .select('+agora.doctorRtcToken +agora.doctorRtmToken +agora.patientRtcToken +agora.patientRtmToken');
  }

  const { agora } = consultation;

  if (participantRole === 'doctor') {
    return {
      uid:           agora.doctorUid,
      rtcToken:      agora.doctorRtcToken,
      rtmToken:      agora.doctorRtmToken,
      channelName:   agora.channelName,
      rtmChannelName:agora.rtmChannelName,
      appId:         agoraConfig.appId,
      expiresAt:     agora.tokenExpiresAt,
    };
  }

  if (participantRole === 'patient') {
    return {
      uid:           agora.patientUid,
      rtcToken:      agora.patientRtcToken,
      rtmToken:      agora.patientRtmToken,
      channelName:   agora.channelName,
      rtmChannelName:agora.rtmChannelName,
      appId:         agoraConfig.appId,
      expiresAt:     agora.tokenExpiresAt,
    };
  }

  throw new Error(`Unknown participantRole: ${participantRole}`);
}

// ── 3. Refresh all tokens for a consultation ──────────────────────────────────

/**
 * Regenerates RTC + RTM tokens for doctor + patient.
 * Increments tokenRefreshCount.
 * Called automatically by getParticipantTokens when near-expiry.
 * Can also be called explicitly (e.g. from a /refresh route).
 *
 * @param {string} consultationId
 * @param {string} updatedBy
 *
 * @returns {{ expiresAt: Date, tokenRefreshCount: number }}
 */
export async function refreshConsultationTokens(consultationId, updatedBy) {
  const consultation = await Consultation.findById(consultationId)
    .select('+agora.doctorRtcToken +agora.doctorRtmToken +agora.patientRtcToken +agora.patientRtmToken');

  if (!consultation) throw new Error('Consultation not found');
  if (!consultation.agora?.channelName) throw new Error('Agora session not provisioned');

  if (!consultation.isActive) {
    throw new Error(`Cannot refresh tokens for consultation in status: ${consultation.status}`);
  }

  const { agora } = consultation;

  // Regenerate — keep same UIDs
  const doctorRtc  = generateRtcToken({ channelName: agora.channelName, uid: agora.doctorUid,  role: 'publisher' });
  const patientRtc = generateRtcToken({ channelName: agora.channelName, uid: agora.patientUid, role: 'publisher' });

  // RTM tokens use userId strings — stored as UIDs numerically but RTM needs string
  // We store doctorUserId from doctorUser field
  const doctorUserIdStr  = consultation.doctorUser?.toString()  || String(agora.doctorUid);
  const patientUserIdStr = consultation.patient?.toString()     || String(agora.patientUid);

  const doctorRtm  = generateRtmToken({ userId: doctorUserIdStr });
  const patientRtm = generateRtmToken({ userId: patientUserIdStr });

  consultation.agora.doctorRtcToken  = doctorRtc.token;
  consultation.agora.patientRtcToken = patientRtc.token;
  consultation.agora.doctorRtmToken  = doctorRtm.token;
  consultation.agora.patientRtmToken = patientRtm.token;
  consultation.agora.tokenExpiresAt  = doctorRtc.expiresAt;
  consultation.agora.tokenRefreshCount = (agora.tokenRefreshCount || 0) + 1;

  consultation.updatedBy = updatedBy;
  await consultation.save();

  return {
    expiresAt:         doctorRtc.expiresAt,
    tokenRefreshCount: consultation.agora.tokenRefreshCount,
  };
}

// ── 4. Generate token for extra participant (interpreter / observer) ───────────

/**
 * Add an extra participant (caregiver, interpreter, observer) to a live session.
 *
 * @param {string} consultationId
 * @param {string} userId        - extra participant User._id
 * @param {'interpreter'|'observer'|'caregiver'} role
 * @param {string} addedBy
 *
 * @returns {{ uid, rtcToken, rtmToken, channelName, appId, expiresAt }}
 */
export async function addExtraParticipantToken(
  consultationId,
  userId,
  role,
  addedBy,
) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw new Error('Consultation not found');

  if (!consultation.isActive) {
    throw new Error('Cannot add participant — consultation not active');
  }

  const { channelName } = consultation.agora;
  const agoraRole = role === 'observer' ? 'subscriber' : 'publisher';
  const uid       = randomUid(role);

  const tokens = generateParticipantTokens({
    channelName,
    uid,
    userId,
    role: agoraRole,
  });

  // Store in agora.extraParticipants
  consultation.agora.extraParticipants = consultation.agora.extraParticipants || [];
  consultation.agora.extraParticipants.push({
    uid,
    role,
    rtcToken: tokens.rtcToken,
    rtmToken: tokens.rtmToken,
  });

  // Also log in additionalParticipants
  consultation.additionalParticipants = consultation.additionalParticipants || [];
  consultation.additionalParticipants.push({
    userId,
    role,
    addedBy,
    addedAt: new Date(),
  });

  consultation.updatedBy = addedBy;
  await consultation.save();

  return {
    uid,
    rtcToken:      tokens.rtcToken,
    rtmToken:      tokens.rtmToken,
    channelName,
    rtmChannelName:consultation.agora.rtmChannelName,
    appId:         agoraConfig.appId,
    expiresAt:     tokens.expiresAt,
  };
}

// ── 5. Verify Agora webhook signature ─────────────────────────────────────────

/**
 * Verify HMAC-SHA256 signature from Agora webhook headers.
 * Call in your webhook route middleware.
 *
 * Agora sends:
 *   Agora-Signature: <hex-hmac>
 *   Agora-Timestamp: <unix-epoch-string>
 *
 * @param {string} rawBody      - req.rawBody (Buffer or string)
 * @param {string} signature    - req.headers['agora-signature']
 * @param {string} timestamp    - req.headers['agora-timestamp']
 *
 * @returns {boolean}
 */
export function verifyAgoraWebhook(rawBody, signature, timestamp) {
  if (!agoraConfig.webhookSecret) {
    throw new Error('[verifyAgoraWebhook] AGORA_WEBHOOK_SECRET not set');
  }

  // Agora signs: timestamp + rawBody
  const payload  = `${timestamp}${rawBody}`;
  const expected = crypto
    .createHmac('sha256', agoraConfig.webhookSecret)
    .update(payload)
    .digest('hex');

  // Timing-safe compare
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature,  'hex'),
    );
  } catch {
    return false;
  }
}

// ── 6. Mark recording consent + start/stop stubs ─────────────────────────────

/**
 * Update recording consent for doctor or patient.
 * Recording starts (via your recording service) only when both consent = true.
 *
 * @param {string} consultationId
 * @param {'doctor'|'patient'} who
 * @param {boolean} consented
 * @param {string} updatedBy
 *
 * @returns {{ bothConsented: boolean }}
 */
export async function updateRecordingConsent(consultationId, who, consented, updatedBy) {
  const consultation = await Consultation.findById(consultationId);
  if (!consultation) throw new Error('Consultation not found');

  if (who === 'doctor')  consultation.agora.recordingConsentDoctor  = consented;
  if (who === 'patient') consultation.agora.recordingConsentPatient = consented;

  // Sync to top-level recordingConsent (for reports)
  consultation.recordingConsent = {
    doctorConsented:  consultation.agora.recordingConsentDoctor,
    patientConsented: consultation.agora.recordingConsentPatient,
    consentTimestamp: new Date(),
  };

  const bothConsented =
    consultation.agora.recordingConsentDoctor &&
    consultation.agora.recordingConsentPatient;

  if (bothConsented) {
    consultation.agora.isRecordingEnabled = true;
  }

  consultation.updatedBy = updatedBy;
  await consultation.save();

  return { bothConsented };
}