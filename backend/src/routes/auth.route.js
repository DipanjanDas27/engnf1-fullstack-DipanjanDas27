import { Router } from 'express';
import { register, login, getProfile } from '../controllers/auth.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

const router = Router();

// Endpoint 1: POST /api/auth/register (Public)
router.post('/register', register);

// Endpoint 2: POST /api/auth/login (Public)
router.post('/login', login);

// Endpoint 3: GET /api/auth/me (Authenticated)
router.get('/me', authenticateUser, getProfile);

export default router;
