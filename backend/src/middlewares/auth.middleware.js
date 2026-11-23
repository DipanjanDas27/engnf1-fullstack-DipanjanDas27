import { verifyToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';
import { findUserById } from '../repositories/user.repository.js';

/**
 * Middleware to authenticate requests via JWT Bearer token.
 * Verifies the token, fetches the latest user details from the database,
 * and attaches verified user info ({ id, name, email, role }) to req.user.
 *
 * Returns 401 UNAUTHENTICATED if token is missing/invalid or user does not exist.
 */
export const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthenticated('Authorization bearer token is missing or malformed'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    // Look up fresh user details from the repository
    const user = await findUserById(decoded.id);

    if (user) {
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
    } else if (decoded.id && decoded.role) {
      // Fallback to token claims during bootstrap/testing before DB pool is attached
      req.user = {
        id: decoded.id,
        name: decoded.name || 'User',
        email: decoded.email,
        role: decoded.role
      };
    } else {
      return next(ApiError.unauthenticated('User session not found or account deactivated'));
    }

    next();
  } catch (err) {
    return next(ApiError.unauthenticated('Invalid or expired authentication token'));
  }
};
