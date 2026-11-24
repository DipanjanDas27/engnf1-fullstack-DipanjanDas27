import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { getAdminStats } from '../services/booking.service.js';

export const getAdminStatsHandler = asyncHandler(async (req, res) => {
  const stats = await getAdminStats();
  sendResponse(res, 200, stats);
});
