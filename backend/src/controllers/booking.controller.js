import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse, sendPaginated } from '../utils/apiResponse.js';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  getAllBookings,
  cancelBooking,
  approveBooking,
  rejectBooking
} from '../services/booking.service.js';

export const createBookingHandler = asyncHandler(async (req, res) => {
  const booking = await createBooking(req.user.id, req.body);
  sendResponse(res, 201, booking);
});

export const getMyBookingsHandler = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const result = await getMyBookings(req.user.id, req.query);
  sendPaginated(res, { data: result.data, page, pageSize: 10, total: result.total });
});

export const getBookingByIdHandler = asyncHandler(async (req, res) => {
  const booking = await getBookingById(req.params.id, req.user);
  sendResponse(res, 200, booking);
});

export const getAllBookingsHandler = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const result = await getAllBookings(req.query);
  sendPaginated(res, { data: result.data, page, pageSize: 10, total: result.total });
});

export const cancelBookingHandler = asyncHandler(async (req, res) => {
  const booking = await cancelBooking(req.params.id, req.user);
  sendResponse(res, 200, booking);
});

export const approveBookingHandler = asyncHandler(async (req, res) => {
  const booking = await approveBooking(req.params.id);
  sendResponse(res, 200, booking);
});

export const rejectBookingHandler = asyncHandler(async (req, res) => {
  const booking = await rejectBooking(req.params.id, req.body.note);
  sendResponse(res, 200, booking);
});
