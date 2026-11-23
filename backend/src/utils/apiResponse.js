/**
 * Formats a paginated response according to the TriageSync API contract:
 * { data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }
 *
 * @param {Array} data - Paginated list of records
 * @param {number|string} page - Current page number
 * @param {number|string} pageSize - Number of items per page
 * @param {number|string} total - Total count of matched items
 * @returns {Object} Contract-compliant paginated response object
 */
export const formatPagination = (data = [], page = 1, pageSize = 10, total = 0) => {
  const totalItems = parseInt(total, 10) || 0;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, parseInt(pageSize, 10) || 10);
  const totalPages = Math.ceil(totalItems / size) || 0;

  return {
    data,
    page: currentPage,
    pageSize: size,
    total: totalItems,
    totalPages
  };
};

/**
 * Sends a paginated JSON response.
 */
export const sendPaginated = (res, { data = [], page = 1, pageSize = 10, total = 0 }, statusCode = 200) => {
  return res.status(statusCode).json(formatPagination(data, page, pageSize, total));
};

/**
 * Sends a standard JSON response.
 */
export const sendResponse = (res, statusCode = 200, payload = {}) => {
  return res.status(statusCode).json(payload);
};
