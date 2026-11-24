import { Router } from 'express';
import {
  importTicketsHandler,
  getTicketsHandler,
  getTicketByIdHandler,
  updateTicketHandler,
  getStatsHandler
} from '../controllers/ticket.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

const router = Router();

// All ticket routes require authentication
router.use(authenticateUser);

// Endpoint 4: POST /api/tickets/import
router.post('/import', importTicketsHandler);

// Endpoint 8: GET /api/stats (mounted via app-level router — not here)

// Endpoint 5: GET /api/tickets
router.get('/', getTicketsHandler);

// Endpoint 6: GET /api/tickets/:id
router.get('/:id', getTicketByIdHandler);

// Endpoint 7: PATCH /api/tickets/:id
router.patch('/:id', updateTicketHandler);

export default router;
