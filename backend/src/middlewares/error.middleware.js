import { ApiError } from '../utils/apiError.js';

/**
 * Centralized Express error-handling middleware.
 * Formats all errors strictly according to Section 7 of the Candidate Brief:
 * { error: { code: "...", message: "..." } }
 */
export const errorHandler = (err, req, res, next) => {
  // Application-defined ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // Body-parser JSON syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload in request body'
      }
    });
  }

  // Fallback for unexpected internal errors
  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred'
    }
  });
};
