import { Router } from 'express';
import authRoutes from './auth.route.js';
import ticketRoutes from './ticket.route.js';
import resourceRoutes from './resource.route.js';
import bookingRoutes from './booking.route.js';
import { getStatsHandler } from '../controllers/ticket.controller.js';
import { getAdminStatsHandler } from '../controllers/stats.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TriageSync API',
    timestamp: new Date().toISOString()
  });
});

// Endpoints 1–3: Auth
router.use('/auth', authRoutes);

// Endpoints 4–7: Tickets
router.use('/tickets', ticketRoutes);

// Endpoint 8: GET /api/stats (Authenticated)
router.get('/stats', authenticateUser, getStatsHandler);

// Endpoints 9–13: Resources
router.use('/resources', resourceRoutes);

// Endpoints 14–20: Bookings
router.use('/bookings', bookingRoutes);

// Endpoint 21: GET /api/admin/stats (ADMIN only)
router.get('/admin/stats', authenticateUser, requireAdmin, getAdminStatsHandler);

export default router;
