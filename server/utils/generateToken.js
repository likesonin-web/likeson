import jwt from 'jsonwebtoken';

/**
 * generateToken
 *
 * Signs a JWT for the given userId.
 *
 * SECURITY NOTE (fixed):
 *   JWT_SECRET in .env must be a random secret string — NOT a JWT token itself.
 *   A JWT token as the secret is a critical vulnerability because:
 *     1. It is predictable (the payload is base64-encoded, not secret).
 *     2. If the secret is compromised, all existing tokens are also compromised.
 *
 *   Correct .env:
 *     JWT_SECRET=some_long_random_secret_string_min_32_chars
 *     JWT_EXPIRES_IN=12h
 *
 * TOKEN LIFETIME:
 *   Defaults to 12 hours. After expiry, the protect middleware returns 401
 *   and the client must redirect to login — effectively auto-logging out.
 *
 * @param   {string|ObjectId} id  — MongoDB user _id
 * @returns {string}              — signed JWT
 */
export const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('[generateToken] JWT_SECRET is not set in environment variables.');
  }

  return jwt.sign(
    { id: id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
};