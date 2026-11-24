import { Router } from 'express';
import {
  createBookingHandler,
  getMyBookingsHandler,
  getBookingByIdHandler,
  getAllBookingsHandler,
  cancelBookingHandler,
  approveBookingHandler,
  rejectBookingHandler
} from '../controllers/booking.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';

const router = Router();

// All booking routes require authentication
router.use(authenticateUser);

// Endpoint 14: POST /api/bookings (Authenticated)
router.post('/', createBookingHandler);

// Endpoint 15: GET /api/bookings/mine (Authenticated — must come before /:id)
router.get('/mine', getMyBookingsHandler);

// Endpoint 17: GET /api/bookings (ADMIN only)
router.get('/', requireAdmin, getAllBookingsHandler);

// Endpoint 16: GET /api/bookings/:id (Owner or ADMIN)
router.get('/:id', getBookingByIdHandler);

// Endpoint 18: PATCH /api/bookings/:id/cancel (Owner)
router.patch('/:id/cancel', cancelBookingHandler);

// Endpoint 19: PATCH /api/bookings/:id/approve (ADMIN only)
router.patch('/:id/approve', requireAdmin, approveBookingHandler);

// Endpoint 20: PATCH /api/bookings/:id/reject (ADMIN only)
router.patch('/:id/reject', requireAdmin, rejectBookingHandler);

export default router;
