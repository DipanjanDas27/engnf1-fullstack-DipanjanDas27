import { Router } from 'express';
import {
  getResourcesHandler,
  getResourceByIdHandler,
  createResourceHandler,
  updateResourceHandler,
  getAvailabilityHandler
} from '../controllers/resource.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';

const router = Router();

// All resource routes require authentication
router.use(authenticateUser);

// Endpoint 9: GET /api/resources (USER: active only, ADMIN: all)
router.get('/', getResourcesHandler);

// Endpoint 11: POST /api/resources (ADMIN only)
router.post('/', requireAdmin, createResourceHandler);

// Endpoint 13: GET /api/resources/:id/availability (Authenticated)
// IMPORTANT: must be registered before /:id to avoid clash
router.get('/:id/availability', getAvailabilityHandler);

// Endpoint 10: GET /api/resources/:id (Authenticated)
router.get('/:id', getResourceByIdHandler);

// Endpoint 12: PATCH /api/resources/:id (ADMIN only)
router.patch('/:id', requireAdmin, updateResourceHandler);

export default router;
