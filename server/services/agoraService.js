 

import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

/**
 * Derive a stable 32-bit unsigned UID from a MongoDB ObjectId string.
 * Hashes all 24 hex chars → avoids sequential-suffix collisions.
 * Never returns 0 (Agora wildcard).
 *
 * @param {string} objectId — MongoDB ObjectId string (24 hex chars)
 * @returns {number} — stable uint32, range 1..4294967295
 */
export const deriveAgoraUid = (objectId) => {
  const hex = String(objectId || '');
  if (!hex) return Math.floor(Math.random() * 0xFFFFFFFE) + 1;

  // djb2 hash over all 24 chars
  let hash = 5381;
  for (let i = 0; i < hex.length; i++) {
    hash = ((hash << 5) + hash + hex.charCodeAt(i)) | 0;
  }

  // Convert to unsigned, ensure never 0
  const uid = (hash >>> 0) || 1;
  return uid;
};

/**
 * UID for screen-share track — offset by 1_000_000 to avoid collision with
 * any regular user uid (regular uids are 32-bit hash of 24-char hex = very
 * unlikely to be near 1_000_000, but use large offset for safety).
 *
 * @param {number} baseUid
 * @returns {number}
 */
export const screenShareUid = (baseUid) => {
  // Add offset but stay within uint32
  return ((baseUid + 1_000_000) >>> 0) || 1_000_001;
};

/**
 * Generate an Agora RTC token for a specific user + channel.
 *
 * FIXED: uid is now a required param — no more UID=0 wildcard tokens.
 * Both host and participant use PUBLISHER role (both need to send a/v).
 *
 * @param {string} channelName
 * @param {number} uid          — numeric UID for this user (use deriveAgoraUid)
 * @param {number} expireSeconds — default 2h
 * @returns {string} RTC token
 */
export const generateAgoraToken = (channelName, uid, expireSeconds = 7200) => {
  const appId = process.env.AGORAIO_APP_ID;
  const appCert = process.env.AGORAIO_APP_CERT;

  if (!appId || !appCert) throw new Error('AGORAIO_APP_ID and AGORAIO_APP_CERT must be set.');
  if (!channelName)        throw new Error('channelName is required.');
  if (!uid || uid === 0)   throw new Error('uid must be a non-zero uint32 (use deriveAgoraUid).');

  const currentTs      = Math.floor(Date.now() / 1000);
  const privilegeExpTs = currentTs + expireSeconds;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCert,
    channelName,
    uid,
    RtcRole.PUBLISHER,  // PUBLISHER for both host/participant — both need to send audio/video
    privilegeExpTs,
    privilegeExpTs,
  );
};

/**
 * Create Agora room metadata from booking info.
 * Channel name: lk-{sanitized bookingCode}, max 64 chars.
 *
 * @param {string} bookingCode
 * @param {string} bookingId
 * @returns {{ channelName: string }}
 */
export const createAgoraRoom = (bookingCode, bookingId) => {
  if (!process.env.AGORAIO_APP_ID || !process.env.AGORAIO_APP_CERT) {
    throw new Error('AGORAIO_APP_ID and AGORAIO_APP_CERT must be set.');
  }
  if (!bookingCode && !bookingId) {
    throw new Error('bookingCode or bookingId required.');
  }

  const raw = String(bookingCode || bookingId)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // strip all non-alphanumeric (including hyphens)

  const channelName = `lk${raw}`.slice(0, 64); // no hyphen in prefix either

  return { channelName };
};
