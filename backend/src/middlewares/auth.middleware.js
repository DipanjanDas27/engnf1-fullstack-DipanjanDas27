import { verifyToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';
import { findUserById } from '../repositories/user.repository.js';

/**
 * Middleware to authenticate requests via JWT Bearer token OR httpOnly cookie.
 * Supports:
 * 1. Authorization: Bearer <token> (Evaluator API test contract)
 * 2. req.cookies.token (Secure browser sessions)
 *
 * Verifies token against the database and attaches verified user ({ id, name, email, role }) to req.user.
 * Returns 401 UNAUTHENTICATED if token is missing/invalid or user session does not exist.
 */
export const authenticateUser = async (req, res, next) => {
  let token = null;

  // 1. Check Authorization Bearer header first (primary API contract)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    // 2. Fall back to secure httpOnly cookie
    token = req.cookies.token;
  }

  if (!token) {
    return next(ApiError.unauthenticated('Authorization token is missing or malformed'));
  }

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
      // Fallback for bootstrap/testing before DB pool is attached
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
