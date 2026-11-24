import { query, getClient } from '../config/db.js';

/**
 * Ticket Repository - Functional data access layer for tickets and ticket_events tables.
 * All queries are parameterized for SQL injection safety (Rule T-B4).
 */

/**
 * Finds a ticket by its external ID for idempotent re-import (Rule T-B2).
 */
export const findTicketByExternalId = async (externalId) => {
  const res = await query(
    `SELECT id, external_id AS "externalId", subject, body,
            auto_category AS "autoCategory", category, is_human_override AS "isHumanOverride",
            priority, status, assignee_id AS "assigneeId",
            is_reviewed AS "isReviewed",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM tickets WHERE external_id = $1`,
    [externalId]
  );
  return res.rows[0] || null;
};

/**
 * Finds a ticket by its UUID.
 */
export const findTicketById = async (id) => {
  const res = await query(
    `SELECT id, external_id AS "externalId", subject, body,
            auto_category AS "autoCategory", category, is_human_override AS "isHumanOverride",
            priority, status, assignee_id AS "assigneeId",
            is_reviewed AS "isReviewed",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM tickets WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
};

/**
 * Inserts a new ticket record.
 */
export const createTicket = async ({ externalId, subject, body, autoCategory, category, priority, status, isHumanOverride = false, isReviewed = false, assigneeId = null }) => {
  const res = await query(
    `INSERT INTO tickets (external_id, subject, body, auto_category, category, is_human_override, priority, status, assignee_id, is_reviewed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, external_id AS "externalId", subject, body,
               auto_category AS "autoCategory", category, is_human_override AS "isHumanOverride",
               priority, status, assignee_id AS "assigneeId",
               is_reviewed AS "isReviewed",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [externalId, subject, body, autoCategory, category, isHumanOverride, priority, status, assigneeId, isReviewed]
  );
  return res.rows[0];
};

/**
 * Updates a ticket by ID with the provided field set.
 * Only updates fields explicitly provided in the updates object.
 */
export const updateTicket = async (id, updates) => {
  const fieldMap = {
    subject: 'subject',
    body: 'body',
    category: 'category',
    priority: 'priority',
    status: 'status',
    assigneeId: 'assignee_id',
    isHumanOverride: 'is_human_override',
    isReviewed: 'is_reviewed'
  };

  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, col] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      setClauses.push(`${col} = $${idx}`);
      values.push(updates[key]);
      idx++;
    }
  }

  if (setClauses.length === 0) return findTicketById(id);

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const res = await query(
    `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = $${idx}
     RETURNING id, external_id AS "externalId", subject, body,
               auto_category AS "autoCategory", category, is_human_override AS "isHumanOverride",
               priority, status, assignee_id AS "assigneeId",
               is_reviewed AS "isReviewed",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    values
  );
  return res.rows[0] || null;
};

/**
 * Inserts an audit event into ticket_events (Rule T-B3).
 */
export const createTicketEvent = async ({ ticketId, field, oldValue, newValue, actor }) => {
  const res = await query(
    `INSERT INTO ticket_events (ticket_id, field, old_value, new_value, actor)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, ticket_id AS "ticketId", field, old_value AS "oldValue",
               new_value AS "newValue", actor, created_at AS "createdAt"`,
    [ticketId, field, oldValue ?? null, newValue ?? null, actor]
  );
  return res.rows[0];
};

/**
 * Returns all audit events for a ticket ordered by newest first.
 */
export const findTicketEvents = async (ticketId) => {
  const res = await query(
    `SELECT id, ticket_id AS "ticketId", field, old_value AS "oldValue",
            new_value AS "newValue", actor, created_at AS "createdAt"
     FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at DESC`,
    [ticketId]
  );
  return res.rows;
};

/**
 * Paginated, parameterized multi-filter ticket search.
 * Combines filters with AND. Query param 'q' searches subject and body safely (Rule T-B4).
 */
export const findTickets = async ({ status, category, priority, q, assigneeId } = {}, { page = 1, limit = 10 } = {}) => {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (status) { conditions.push(`status = $${idx++}`); values.push(status); }
  if (category) { conditions.push(`category = $${idx++}`); values.push(category); }
  if (priority) { conditions.push(`priority = $${idx++}`); values.push(priority); }
  if (assigneeId) { conditions.push(`assignee_id = $${idx++}`); values.push(assigneeId); }

  // Safe trigram search - never string-interpolated, fully parameterized
  if (q && q.trim()) {
    conditions.push(`(subject ILIKE $${idx} OR body ILIKE $${idx})`);
    values.push(`%${q.trim()}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(`SELECT COUNT(*) FROM tickets ${where}`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  values.push(limit, offset);
  const dataRes = await query(
    `SELECT id, external_id AS "externalId", subject, body,
            auto_category AS "autoCategory", category, is_human_override AS "isHumanOverride",
            priority, status, assignee_id AS "assigneeId",
            is_reviewed AS "isReviewed",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM tickets ${where}
     ORDER BY
       CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
       created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return { data: dataRes.rows, total };
};

/**
 * Aggregated stats for dashboard: counts by category, priority, status,
 * reviewed count, and model agreement rate (Rule T-B3).
 */
export const getTicketStats = async () => {
  const res = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'OPEN')        AS "openCount",
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS "inProgressCount",
      COUNT(*) FILTER (WHERE status = 'RESOLVED')    AS "resolvedCount",
      COUNT(*) FILTER (WHERE status = 'CLOSED')      AS "closedCount",
      COUNT(*) FILTER (WHERE category = 'BILLING')        AS "billingCount",
      COUNT(*) FILTER (WHERE category = 'BUG')            AS "bugCount",
      COUNT(*) FILTER (WHERE category = 'FEATURE_REQUEST') AS "featureRequestCount",
      COUNT(*) FILTER (WHERE category = 'LOGIN')           AS "loginCount",
      COUNT(*) FILTER (WHERE category = 'DELIVERY')        AS "deliveryCount",
      COUNT(*) FILTER (WHERE priority = 'URGENT') AS "urgentCount",
      COUNT(*) FILTER (WHERE priority = 'HIGH')   AS "highCount",
      COUNT(*) FILTER (WHERE priority = 'MEDIUM') AS "mediumCount",
      COUNT(*) FILTER (WHERE priority = 'LOW')    AS "lowCount",
      COUNT(*) FILTER (WHERE is_reviewed = TRUE)  AS "reviewedCount",
      COUNT(*)                                     AS "totalCount",
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE category = auto_category) / NULLIF(COUNT(*), 0), 2
      ) AS "modelAgreementRate"
    FROM tickets
  `);
  return res.rows[0];
};
