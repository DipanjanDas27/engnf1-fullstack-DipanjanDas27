import { ApiError } from '../utils/apiError.js';

/**
 * Middleware to restrict endpoints to users with the ADMIN role.
 * Returns 403 FORBIDDEN if the authenticated user is not an administrator.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(ApiError.forbidden('Administrative privileges required for this action'));
  }
  next();
};

/**
 * Higher-order middleware to enforce specific allowed roles.
 *
 * @param  {...string} allowedRoles - List of permitted roles (e.g. 'ADMIN', 'USER')
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have the required role to access this resource'));
    }
    next();
  };
};
