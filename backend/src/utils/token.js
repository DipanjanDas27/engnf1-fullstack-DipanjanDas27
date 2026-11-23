import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'triagesync-development-secret-jwt-key';

/**
 * Generates a signed JWT with standard 24-hour expiration (mandated by Rule B16).
 *
 * @param {Object} payload - User identification payload (e.g., { id })
 * @param {string} expiresIn - Expiration window (default: '24h')
 * @returns {string} Signed JWT string
 */
export const generateToken = (payload, expiresIn = '24h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws an error if invalid or expired.
 *
 * @param {string} token - Bearer JWT string
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
