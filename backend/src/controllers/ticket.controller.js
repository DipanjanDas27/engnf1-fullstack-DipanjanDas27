import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse, sendPaginated } from '../utils/apiResponse.js';
import {
  importTickets,
  getTickets,
  getTicketById,
  updateTicket,
  getStats
} from '../services/ticket.service.js';

export const importTicketsHandler = asyncHandler(async (req, res) => {
  const { tickets } = req.body;
  const result = await importTickets(tickets);
  sendResponse(res, 200, result);
});

export const getTicketsHandler = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const result = await getTickets(req.query);
  sendPaginated(res, { data: result.data, page, pageSize: limit, total: result.total });
});

export const getTicketByIdHandler = asyncHandler(async (req, res) => {
  const result = await getTicketById(req.params.id);
  sendResponse(res, 200, result);
});

export const updateTicketHandler = asyncHandler(async (req, res) => {
  // Actor: prefer X-Agent header, fall back to authenticated user email
  const actor = req.headers['x-agent'] || req.user.email;
  const result = await updateTicket(req.params.id, req.body, actor);
  sendResponse(res, 200, result);
});

export const getStatsHandler = asyncHandler(async (req, res) => {
  const stats = await getStats();
  sendResponse(res, 200, stats);
});
