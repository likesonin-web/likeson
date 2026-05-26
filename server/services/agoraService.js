import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

/**
 * generateAgoraToken
 * @param {string} channelName — The unique name of the channel/room
 * @param {'host'|'participant'} role — host gets PUBLISHER, participant gets SUBSCRIBER
 * @param {number} uid — User ID (0 allows Agora to auto-assign)
 * @param {number} expireTimeInSeconds — default 86400 (24 hours)
 * @returns {string} signed Agora RTC Token
 */
export const generateAgoraToken = (
  channelName,
  role = 'participant',
  uid = 0,
  expireTimeInSeconds = 86400
) => {
  const appId = process.env.AGORAIO_APP_ID;
  const appCertificate = process.env.AGORAIO_APP_CERT;

  if (!appId || !appCertificate) {
    throw new Error('AGORAIO_APP_ID and AGORAIO_APP_CERT must be set in environment');
  }

  if (!channelName) {
    throw new Error('channelName is required to generate an Agora token');
  }

  const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  const currentTimestamp   = Math.floor(Date.now() / 1000);
  const tokenExpire        = currentTimestamp + expireTimeInSeconds;

  // privilegeExpire = 0 means privileges are bound to tokenExpire (recommended)
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    tokenExpire,
    0  // privilegeExpire: 0 = expires with token
  );

  return token;
};

/**
 * createAgoraRoom
 * Agora channels are created dynamically on first join — no API call needed.
 * Generates a deterministic, URL-safe channel name from the booking code.
 *
 * @param {string} bookingCode — used as channel name base (e.g. "BK-ABC12345")
 * @param {string} bookingId   — MongoDB ObjectId string, used for the meeting link
 * @returns {{ roomId: string, meetingId: string, meetingLink: string }}
 */
export const createAgoraRoom = (bookingCode, bookingId) => {
  if (!process.env.AGORAIO_APP_ID || !process.env.AGORAIO_APP_CERT) {
    throw new Error('AGORAIO_APP_ID and AGORAIO_APP_CERT must be set in environment');
  }

  if (!bookingCode && !bookingId) {
    throw new Error('bookingCode or bookingId required to create Agora room');
  }

  // Sanitize: lowercase, strip non-alphanumeric except hyphens (Agora safe chars)
  const raw         = String(bookingCode || bookingId);
  const channelName = `likeson-${raw.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

  const baseUrl    = process.env.FRONTEND_URL || 'http://localhost:3000';
  const meetingLink = `${baseUrl}/consultations/${bookingId}/room`;

  return {
    roomId:    channelName,
    meetingId: channelName, // Agora: channelName IS the meeting identifier
    meetingLink,
  };
};