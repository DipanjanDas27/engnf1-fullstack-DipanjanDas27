import {
  findTicketByExternalId,
  findTicketById,
  createTicket,
  updateTicket as updateTicketInDb,
  createTicketEvent,
  findTicketEvents,
  findTickets as findTicketsInDb,
  getTicketStats
} from '../repositories/ticket.repository.js';
import { classifyTicket } from './classifier.service.js';
import { ApiError } from '../utils/apiError.js';

const VALID_CATEGORIES = ['BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

/**
 * Idempotent batch ticket import preserving human overrides (Rules T-B1 & T-B2).
 *
 * @param {Array<{ externalId: string, subject: string, body: string }>} tickets
 * @returns {Promise<{ importedCount: number, updatedCount: number, skippedOverrideCount: number, total: number }>}
 */
export const importTickets = async (tickets = []) => {
  if (!Array.isArray(tickets)) {
    throw ApiError.validationError('Request body must contain an array of tickets');
  }

  let importedCount = 0;
  let updatedCount = 0;
  let skippedOverrideCount = 0;

  for (const item of tickets) {
    const { externalId, subject, body } = item;

    if (!externalId || typeof externalId !== 'string' || !externalId.trim()) {
      throw ApiError.validationError('Each ticket must possess a valid externalId string');
    }
    if (!subject || subject.trim().length < 3 || subject.trim().length > 150) {
      throw ApiError.validationError('Ticket subject must be between 3 and 150 characters');
    }
    if (!body || body.trim().length < 5 || body.trim().length > 2000) {
      throw ApiError.validationError('Ticket body must be between 5 and 2000 characters');
    }

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    const { category: autoCategory, priority } = classifyTicket(trimmedSubject, trimmedBody);

    const existing = await findTicketByExternalId(externalId.trim());

    if (!existing) {
      // New ticket: assign auto-classification
      await createTicket({
        externalId: externalId.trim(),
        subject: trimmedSubject,
        body: trimmedBody,
        autoCategory,
        category: autoCategory,
        priority,
        status: 'OPEN',
        isHumanOverride: false,
        isReviewed: false
      });
      importedCount++;
    } else {
      // Existing ticket: Rule T-B2 idempotent re-import
      if (existing.isHumanOverride) {
        // Human override active: update subject/body only, NEVER overwrite category
        await updateTicketInDb(existing.id, {
          subject: trimmedSubject,
          body: trimmedBody
        });
        skippedOverrideCount++;
      } else {
        // No human override: re-run auto-classification
        await updateTicketInDb(existing.id, {
          subject: trimmedSubject,
          body: trimmedBody,
          autoCategory,
          category: autoCategory,
          priority
        });
        updatedCount++;
      }
    }
  }

  return {
    importedCount,
    updatedCount,
    skippedOverrideCount,
    total: tickets.length
  };
};

/**
 * Retrieves paginated tickets using combined AND filtering and injection-safe text search (Rule T-B4).
 */
export const getTickets = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 10);
  const { status, category, priority, q, assigneeId } = query;

  if (status && !VALID_STATUSES.includes(status)) {
    throw ApiError.validationError(`Invalid status filter: ${status}`);
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    throw ApiError.validationError(`Invalid category filter: ${category}`);
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    throw ApiError.validationError(`Invalid priority filter: ${priority}`);
  }

  return findTicketsInDb({ status, category, priority, q, assigneeId }, { page, limit });
};

/**
 * Retrieves a ticket along with its immutable audit event history (Rule T-B3).
 */
export const getTicketById = async (id) => {
  const ticket = await findTicketById(id);
  if (!ticket) {
    throw ApiError.notFound(`Ticket with ID ${id} not found`);
  }

  const events = await findTicketEvents(id);
  return { ticket, events };
};

/**
 * Updates ticket fields, writes audit records, and manages human override & review flags (Rule T-B3).
 *
 * @param {string} id - Ticket UUID
 * @param {Object} updates - Fields to update (category, priority, status, assigneeId)
 * @param {string} actor - User email or X-Agent header
 */
export const updateTicket = async (id, updates = {}, actor = 'System') => {
  const ticket = await findTicketById(id);
  if (!ticket) {
    throw ApiError.notFound(`Ticket with ID ${id} not found`);
  }

  if (updates.category && !VALID_CATEGORIES.includes(updates.category)) {
    throw ApiError.validationError(`Invalid category: ${updates.category}`);
  }
  if (updates.priority && !VALID_PRIORITIES.includes(updates.priority)) {
    throw ApiError.validationError(`Invalid priority: ${updates.priority}`);
  }
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    throw ApiError.validationError(`Invalid status: ${updates.status}`);
  }

  const changes = [];
  const fieldsToPersist = {};

  for (const field of ['category', 'priority', 'status', 'assigneeId']) {
    if (updates[field] !== undefined && updates[field] !== ticket[field]) {
      changes.push({
        ticketId: id,
        field,
        oldValue: ticket[field] ? String(ticket[field]) : null,
        newValue: updates[field] ? String(updates[field]) : null,
        actor
      });
      fieldsToPersist[field] = updates[field];
    }
  }

  // (1) If category changes, set isHumanOverride = true
  if (fieldsToPersist.category && fieldsToPersist.category !== ticket.category) {
    fieldsToPersist.isHumanOverride = true;
  }

  // (2) Set isReviewed = true when category is updated OR status transitions from OPEN
  if (
    fieldsToPersist.category ||
    (fieldsToPersist.status && ticket.status === 'OPEN' && fieldsToPersist.status !== 'OPEN')
  ) {
    fieldsToPersist.isReviewed = true;
  }

  // Update ticket record
  const updated = await updateTicketInDb(id, fieldsToPersist);

  // (3) Write audit row for every changed field
  for (const change of changes) {
    await createTicketEvent(change);
  }

  const events = await findTicketEvents(id);
  return { ticket: updated, events };
};

/**
 * Aggregates summary stats for the dashboard (Endpoint 8).
 */
export const getStats = async () => {
  const raw = await getTicketStats();

  return {
    byCategory: {
      BILLING: parseInt(raw.billingCount, 10) || 0,
      BUG: parseInt(raw.bugCount, 10) || 0,
      FEATURE_REQUEST: parseInt(raw.featureRequestCount, 10) || 0,
      LOGIN: parseInt(raw.loginCount, 10) || 0,
      DELIVERY: parseInt(raw.deliveryCount, 10) || 0
    },
    byPriority: {
      LOW: parseInt(raw.lowCount, 10) || 0,
      MEDIUM: parseInt(raw.mediumCount, 10) || 0,
      HIGH: parseInt(raw.highCount, 10) || 0,
      URGENT: parseInt(raw.urgentCount, 10) || 0
    },
    byStatus: {
      OPEN: parseInt(raw.openCount, 10) || 0,
      IN_PROGRESS: parseInt(raw.inProgressCount, 10) || 0,
      RESOLVED: parseInt(raw.resolvedCount, 10) || 0,
      CLOSED: parseInt(raw.closedCount, 10) || 0
    },
    reviewedCount: parseInt(raw.reviewedCount, 10) || 0,
    modelAgreementRate: parseFloat(raw.modelAgreementRate) || 0
  };
};
