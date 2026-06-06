// utils/generateAgoraToken.js
// Low-level token generators — pure functions, no DB, no side effects.
// Used by agoraToken.js

import pkg from 'agora-token';
const { RtcTokenBuilder, RtmTokenBuilder, RtcRole } = pkg;

import agoraConfig from '../config/agora.config.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Current epoch (seconds) + offset
 * @param {number} offsetSec
 */
const expireAt = (offsetSec) => Math.floor(Date.now() / 1000) + offsetSec;

/**
 * Map custom role string → Agora RtcRole int
 * @param {'publisher'|'subscriber'} role
 */
const toRtcRole = (role) =>
  role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

// ── RTC Token ─────────────────────────────────────────────────────────────────

export const generateRtcToken = ({ channelName, uid, role = 'publisher', expireSec = agoraConfig?.tokenExpireSec || 7200 }) => {
  const agoraRole = toRtcRole(role);
  const privilegeExpiredTs = expireAt(expireSec);

  const token = RtcTokenBuilder.buildTokenWithUid(
    agoraConfig?.appId || process.env.AGORAIO_APP_ID,
    agoraConfig?.appCert || process.env.AGORAIO_APP_CERT,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs,
    privilegeExpiredTs
  );
  return { token, expiresAt: new Date(privilegeExpiredTs * 1000) };
};

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
export function generateRtmToken({ userId, expireSec = agoraConfig?.rtm?.expireSec || 7200 }) {
  if (!userId) throw new Error('[generateRtmToken] userId required');

  const privilegeExpiredTs = expireAt(expireSec);

  const token = RtmTokenBuilder.buildToken(
    agoraConfig?.appId || process.env.AGORAIO_APP_ID,
    agoraConfig?.appCert || process.env.AGORAIO_APP_CERT,
    String(userId),
    privilegeExpiredTs
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
 * rtcToken: string,
 * rtmToken: string,
 * uid: number,
 * userId: string,
 * channelName: string,
 * expiresAt: Date,
 * }}
 */
export function generateParticipantTokens({
  channelName,
  uid,
  userId,
  role = 'publisher',
  expireSec = agoraConfig?.tokenExpireSec || 7200,
}) {
  const rtc = generateRtcToken({ channelName, uid, role, expireSec });
  const rtm = generateRtmToken({ userId, expireSec });

  return {
    rtcToken:   rtc.token,
    rtmToken:   rtm.token,
    uid,
    userId:     String(userId),
    channelName,
    expiresAt:  rtc.expiresAt,
  };
}

// ── Dedicated Screen Share Token Generator ────────────────────────────────────

/**
 * Generate an Agora RTC token for a specific user + channel.
 * Used primarily for the dedicated screen-share client.
 *
 * @param {string} channelName
 * @param {number} uid            numeric UID for this user
 * @param {number} expireSeconds  default 7200 (2h)
 * @returns {string} RTC token string
 */
export const generateAgoraToken = (channelName, uid, expireSeconds = 7200) => {
  if (!channelName) throw new Error('[generateAgoraToken] channelName is required.');
  if (!uid || uid === 0) throw new Error('[generateAgoraToken] uid must be a non-zero uint32.');

  const privilegeExpiredTs = expireAt(expireSeconds);

  return RtcTokenBuilder.buildTokenWithUid(
    agoraConfig?.appId || process.env.AGORAIO_APP_ID,
    agoraConfig?.appCert || process.env.AGORAIO_APP_CERT,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs,
    privilegeExpiredTs
  );
};