/**
 * Custom application error class conforming to the TriageSync API error contract:
 * { error: { code: '...', message: '...' } }
 *
 * Supported codes: VALIDATION_ERROR (400/422), UNAUTHENTICATED (401),
 * FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409)
 */
export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }

  static validationError(message = 'Invalid request parameters or payload') {
    return new ApiError(400, 'VALIDATION_ERROR', message);
  }

  static unauthenticated(message = 'Authentication token required or invalid') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Requested resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Resource conflict or business rule violation') {
    return new ApiError(409, 'CONFLICT', message);
  }
}
