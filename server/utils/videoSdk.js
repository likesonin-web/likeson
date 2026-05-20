import jwt  from 'jsonwebtoken';
import axios from 'axios';

/**
 * generateVideoSdkToken
 * @param {string|null}   roomId      — scope token to specific room (recommended)
 * @param {'host'|'participant'} role — host gets allow_mod, participant gets allow_join only
 * @param {string|number} expiresIn   — default '24h'
 * @returns {string} signed JWT
 */
export const generateVideoSdkToken = (
  roomId    = null,
  role      = 'participant',
  expiresIn = '24h'
) => {
  if (!process.env.VIDEOSDK_API_KEY || !process.env.VIDEOSDK_SECRET_KEY) {
    throw new Error(
      'VIDEOSDK_API_KEY and VIDEOSDK_SECRET_KEY must be set in environment'
    );
  }

  const permissions =
    role === 'host'
      ? ['allow_join', 'allow_mod']
      : ['allow_join'];

  const payload = {
    apikey:      process.env.VIDEOSDK_API_KEY,
    permissions,
    ...(roomId ? { roomId } : {}),
    version:     2,
    roles:       role === 'host' ? ['CRAWLER'] : [],
  };

  return jwt.sign(payload, process.env.VIDEOSDK_SECRET_KEY, {
    expiresIn,
    algorithm: 'HS256',
  });
};

/**
 * createVideoSdkRoom
 * Calls VideoSDK API to create a room and returns roomId + meetingLink.
 * Call this once when booking payment is confirmed.
 *
 * @param {string} bookingCode — used as customRoomId for traceability
 * @param {string} bookingId — used to construct the frontend meeting link
 * @returns {{ roomId: string, meetingId: string, meetingLink: string }}
 */
export const createVideoSdkRoom = async (bookingCode, bookingId) => {
  if (!process.env.VIDEOSDK_API_KEY || !process.env.VIDEOSDK_SECRET_KEY) {
    throw new Error(
      'VIDEOSDK_API_KEY and VIDEOSDK_SECRET_KEY must be set in environment'
    );
  }

  // Server-side token (no roomId scope needed for room creation)
  const token = generateVideoSdkToken(null, 'host', '1h');

  const response = await axios.post(
    'https://api.videosdk.live/v2/rooms',
    {
      customRoomId: `likeson-${bookingCode.toLowerCase()}`,
    },
    {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    }
  );

  const { roomId } = response.data;
  if (!roomId) throw new Error('VideoSDK room creation failed — no roomId returned');

  // FIX: Redirect users to your frontend application route, NOT the VideoSDK api.
  // Adjust the path string below if your Next.js route is different.
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const meetingLink = `${baseUrl}/consultations/${bookingId}/room`;

  return {
    roomId,
    meetingId:   roomId,   // VideoSDK uses roomId as meetingId
    meetingLink,
  };
};