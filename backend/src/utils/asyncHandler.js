/**
 * Higher-order function to catch asynchronous errors in Express route handlers
 * and pass them to the next error-handling middleware.
 *
 * @param {Function} requestHandler - Asynchronous Express middleware/controller function
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
