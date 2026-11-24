import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse, sendPaginated } from '../utils/apiResponse.js';
import {
  getResources,
  getResourceById,
  createResource,
  updateResource
} from '../services/resource.service.js';
import { getAvailability } from '../services/booking.service.js';

export const getResourcesHandler = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const result = await getResources(req.query, req.user);
  sendPaginated(res, { data: result.data, page, pageSize: limit, total: result.total });
});

export const getResourceByIdHandler = asyncHandler(async (req, res) => {
  const resource = await getResourceById(req.params.id, req.user);
  sendResponse(res, 200, resource);
});

export const createResourceHandler = asyncHandler(async (req, res) => {
  const resource = await createResource(req.body);
  sendResponse(res, 201, resource);
});

export const updateResourceHandler = asyncHandler(async (req, res) => {
  const resource = await updateResource(req.params.id, req.body);
  sendResponse(res, 200, resource);
});

export const getAvailabilityHandler = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const availability = await getAvailability(req.params.id, from, to);
  sendResponse(res, 200, availability);
});
