 

import jwt from 'jsonwebtoken';

/**
 * @param {'allow_join'|'allow_mod'|string[]} [permissions]
 * @param {string|number} [expiresIn] — default '24h'
 * @returns {string} signed JWT
 */
export const generateVideoSdkToken = (
  permissions = ['allow_join', 'allow_mod'],
  expiresIn   = '24h'
) => {
  if (!process.env.VIDEOSDK_API_KEY || !process.env.VIDEOSDK_SECRET_KEY) {
    throw new Error(
      'VIDEOSDK_API_KEY and VIDEOSDK_SECRET_KEY must be set in environment'
    );
  }

  const payload = {
    apikey:      process.env.VIDEOSDK_API_KEY,
    permissions: Array.isArray(permissions) ? permissions : [permissions],
  };

  return jwt.sign(payload, process.env.VIDEOSDK_SECRET_KEY, {
    expiresIn,
    algorithm: 'HS256',
  });
};