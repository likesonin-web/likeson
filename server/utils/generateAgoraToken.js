// utils/generateAgoraToken.js
// Low-level token generators — pure functions, no DB, no side effects.
// Used by agoraToken.js
//
// FIX #1: RtcTokenBuilder.buildTokenWithUid called with correct 6 args (not 7).
//         Original code passed privilegeExpiredTs twice — second arg was wrong.

import pkg from 'agora-token';
const { RtcTokenBuilder, RtmTokenBuilder, RtcRole } = pkg;

import agoraConfig from '../config/agora.config.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Current epoch (seconds) + offset
 * @param {number} offsetSec
 */
const expireAt = (offsetSec) =>
  Math.floor(Date.now() / 1000) + offsetSec;

/**
 * Map custom role string → Agora RtcRole int
 * @param {'publisher'|'subscriber'} role
 */
const toRtcRole = (role) =>
  role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

// ── RTC Token ─────────────────────────────────────────────────────────────────

/**
 * Generate Agora RTC token (video/audio session)
 *
 * agora-token v2 buildTokenWithUid signature:
 *   buildTokenWithUid(appId, appCert, channelName, uid, role, privilegeExpiredTs)
 *   → 6 arguments only.
 *
 * @param {object}  opts
 * @param {string}  opts.channelName
 * @param {number}  opts.uid           Agora UID (uint32)
 * @param {'publisher'|'subscriber'} [opts.role='publisher']
 * @param {number}  [opts.expireSec]   override default TTL
 *
 * @returns {{ token: string, expiresAt: Date, uid: number, channelName: string }}
 */
export function generateRtcToken({
  channelName,
  uid,
  role = 'publisher',
  expireSec = agoraConfig.tokenExpireSec,
}) {
  if (!channelName) throw new Error('[generateRtcToken] channelName required');
  if (uid === undefined || uid === null) throw new Error('[generateRtcToken] uid required');

  const privilegeExpiredTs = expireAt(expireSec);
  const rtcRole            = toRtcRole(role);

  // ── FIX #1 — 6 args only (agora-token v2) ────────────────────────────────
  // Original had 7 args: ...role, privilegeExpiredTs, privilegeExpiredTs
  // The 7th param does not exist in v2 and caused silent/incorrect behavior.
  const token = RtcTokenBuilder.buildTokenWithUid(
    agoraConfig.appId,
    agoraConfig.appCert,
    channelName,
    uid,
    rtcRole,
    privilegeExpiredTs,   // single expiry — controls all privileges
  );

  return {
    token,
    uid,
    channelName,
    expiresAt: new Date(privilegeExpiredTs * 1000),
  };
}

// ── RTM Token ─────────────────────────────────────────────────────────────────

/**
 * Generate Agora RTM token (real-time messaging / in-session chat)
 *
 * @param {object}  opts
 * @param {string}  opts.userId    MongoDB _id.toString() — MUST match value used at provision
 * @param {number}  [opts.expireSec]
 *
 * @returns {{ token: string, expiresAt: Date, userId: string }}
 */
export function generateRtmToken({
  userId,
  expireSec = agoraConfig.rtm.expireSec,
}) {
  if (!userId) throw new Error('[generateRtmToken] userId required');

  const privilegeExpiredTs = expireAt(expireSec);

  const token = RtmTokenBuilder.buildToken(
    agoraConfig.appId,
    agoraConfig.appCert,
    String(userId),
    privilegeExpiredTs,
  );

  return {
    token,
    userId: String(userId),
    expiresAt: new Date(privilegeExpiredTs * 1000),
  };
}

// ── Both tokens at once ───────────────────────────────────────────────────────

/**
 * Generate RTC + RTM tokens for one participant in one call.
 *
 * @param {object} opts
 * @param {string} opts.channelName
 * @param {number} opts.uid            numeric Agora UID
 * @param {string} opts.userId         MongoDB _id string (for RTM)
 * @param {'publisher'|'subscriber'} [opts.role='publisher']
 * @param {number} [opts.expireSec]
 *
 * @returns {{
 *   rtcToken: string,
 *   rtmToken: string,
 *   uid: number,
 *   userId: string,
 *   channelName: string,
 *   expiresAt: Date,
 * }}
 */
export function generateParticipantTokens({
  channelName,
  uid,
  userId,
  role = 'publisher',
  expireSec = agoraConfig.tokenExpireSec,
}) {
  const rtc = generateRtcToken({ channelName, uid, role, expireSec });
  const rtm = generateRtmToken({ userId, expireSec });

  return {
    rtcToken:   rtc.token,
    rtmToken:   rtm.token,
    uid,
    userId:     String(userId),
    channelName,
    expiresAt:  rtc.expiresAt, // RTC and RTM share same TTL
  };
}