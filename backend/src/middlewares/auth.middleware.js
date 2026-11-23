import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'triagesync-development-secret-jwt-key';

/**
 * Middleware to authenticate requests via JWT Bearer token.
 * Attaches decoded user payload ({ id, email, role }) to req.user.
 * Returns 401 UNAUTHENTICATED if token is missing or invalid.
 */
export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthenticated('Authorization bearer token is missing or malformed'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return next(ApiError.unauthenticated('Invalid or expired authentication token'));
  }
};
