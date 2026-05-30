import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

export const generateAgoraToken = (
  channelName,
  role = 'participant',
  _userAccount = '',          // kept for API compat, unused
  expireTimeInSeconds = 7200
) => {
  const appId          = process.env.AGORAIO_APP_ID;
  const appCertificate = process.env.AGORAIO_APP_CERT;

  if (!appId || !appCertificate)
    throw new Error('AGORAIO_APP_ID and AGORAIO_APP_CERT must be set.');
  if (!channelName)
    throw new Error('channelName is required.');

  // Both host and participant need PUBLISHER to send audio/video
  const agoraRole          = RtcRole.PUBLISHER;
  const currentTimestamp   = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireTimeInSeconds;

  // UID = 0 → wildcard token, frontend can join with any numeric UID
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    0,
    agoraRole,
    privilegeExpiredTs,
    privilegeExpiredTs   // remove this line if using agora-token < 2.0
  );
};

export const createAgoraRoom = (bookingCode, bookingId) => {
  if (!process.env.AGORAIO_APP_ID || !process.env.AGORAIO_APP_CERT)
    throw new Error('AGORAIO_APP_ID and AGORAIO_APP_CERT must be set.');
  if (!bookingCode && !bookingId)
    throw new Error('bookingCode or bookingId required.');

  const raw         = String(bookingCode || bookingId);
  const channelName = `likeson-${raw.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  // removed hyphen from char class — bookingCode may have hyphens that sanitize away cleanly

  return { channelName };
};