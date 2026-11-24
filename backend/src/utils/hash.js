import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password using bcrypt.
 * @param {string} password - Plain-text password
 * @returns {Promise<string>} Bcrypt hashed password
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * @param {string} password - Plain-text password from request
 * @param {string} hash - Stored bcrypt hash from database
 * @returns {Promise<boolean>} True if match, false otherwise
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};
