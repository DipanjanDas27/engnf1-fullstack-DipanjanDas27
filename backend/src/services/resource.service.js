import {
  findResourceById,
  findResourceByName,
  findResources as findResourcesInDb,
  createResource as createResourceInDb,
  updateResource as updateResourceInDb
} from '../repositories/resource.repository.js';
import { ApiError } from '../utils/apiError.js';

const VALID_TYPES = ['ROOM', 'LAB', 'EQUIPMENT'];

/**
 * Retrieves paginated resources.
 * Standard USERs see only active resources; ADMINs see all.
 */
export const getResources = async (query = {}, user = null) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 10);
  const { type, minCapacity, search } = query;

  if (type && !VALID_TYPES.includes(type)) {
    throw ApiError.validationError(`Invalid resource type: ${type}. Must be ROOM, LAB, or EQUIPMENT`);
  }

  let parsedMinCapacity;
  if (minCapacity !== undefined) {
    parsedMinCapacity = parseInt(minCapacity, 10);
    if (isNaN(parsedMinCapacity) || parsedMinCapacity < 1) {
      throw ApiError.validationError('minCapacity must be a positive integer');
    }
  }

  // USER sees active only; ADMIN sees all
  const isActive = user && user.role === 'ADMIN' ? undefined : true;

  return findResourcesInDb(
    { type, minCapacity: parsedMinCapacity, isActive, search },
    { page, limit }
  );
};

/**
 * Retrieves a single resource by UUID.
 * Returns 404 if not found or if inactive and requested by a standard USER.
 */
export const getResourceById = async (id, user = null) => {
  const resource = await findResourceById(id);
  if (!resource) {
    throw ApiError.notFound(`Resource with ID ${id} not found`);
  }

  if (!resource.isActive && (!user || user.role !== 'ADMIN')) {
    throw ApiError.notFound(`Resource with ID ${id} not found`);
  }

  return resource;
};

/**
 * Creates a new resource (ADMIN only).
 */
export const createResource = async ({ name, type, capacity, description }) => {
  if (!name || name.trim().length < 3 || name.trim().length > 60) {
    throw ApiError.validationError('Resource name must be between 3 and 60 characters');
  }

  if (!type || !VALID_TYPES.includes(type)) {
    throw ApiError.validationError('Resource type must be ROOM, LAB, or EQUIPMENT');
  }

  const parsedCapacity = parseInt(capacity, 10);
  if (isNaN(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 500) {
    throw ApiError.validationError('Resource capacity must be an integer between 1 and 500');
  }

  if (description && description.length > 300) {
    throw ApiError.validationError('Description must be 300 characters or fewer');
  }

  const trimmedName = name.trim();
  const existing = await findResourceByName(trimmedName);
  if (existing) {
    throw ApiError.conflict(`A resource with name "${trimmedName}" already exists`);
  }

  return createResourceInDb({
    name: trimmedName,
    type,
    capacity: parsedCapacity,
    description: description ? description.trim() : null,
    isActive: true
  });
};

/**
 * Updates a resource (ADMIN only).
 */
export const updateResource = async (id, updateData = {}) => {
  const existing = await findResourceById(id);
  if (!existing) {
    throw ApiError.notFound(`Resource with ID ${id} not found`);
  }

  const { name, type, capacity, description, isActive } = updateData;
  const updates = {};

  if (name !== undefined) {
    if (name.trim().length < 3 || name.trim().length > 60) {
      throw ApiError.validationError('Resource name must be between 3 and 60 characters');
    }
    const duplicate = await findResourceByName(name.trim());
    if (duplicate && duplicate.id !== id) {
      throw ApiError.conflict(`A resource with name "${name.trim()}" already exists`);
    }
    updates.name = name.trim();
  }

  if (type !== undefined) {
    if (!VALID_TYPES.includes(type)) {
      throw ApiError.validationError('Resource type must be ROOM, LAB, or EQUIPMENT');
    }
    updates.type = type;
  }

  if (capacity !== undefined) {
    const parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 500) {
      throw ApiError.validationError('Capacity must be an integer between 1 and 500');
    }
    updates.capacity = parsedCapacity;
  }

  if (description !== undefined) {
    if (description && description.length > 300) {
      throw ApiError.validationError('Description must be 300 characters or fewer');
    }
    updates.description = description ? description.trim() : null;
  }

  if (isActive !== undefined) {
    updates.isActive = Boolean(isActive);
  }

  return updateResourceInDb(id, updates);
};
