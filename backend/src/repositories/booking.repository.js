import { query, getClient } from '../config/db.js';

/**
 * Booking Repository - Functional data access layer for bookings table.
 * Concurrency-safe atomic insert using row-level locking (Rules B5 & B6).
 */

const BOOKING_SELECT = `
  SELECT b.id, b.resource_id AS "resourceId", b.user_id AS "userId",
         b.ticket_id AS "ticketId", b.start_time AS "startTime",
         b.end_time AS "endTime", b.purpose, b.status,
         b.decision_note AS "decisionNote", b.created_at AS "createdAt",
         r.name AS "resourceName", r.type AS "resourceType",
         u.name AS "userName", u.email AS "userEmail"
  FROM bookings b
  JOIN resources r ON r.id = b.resource_id
  JOIN users u ON u.id = b.user_id
`;

/**
 * Finds a booking by its UUID.
 */
export const findBookingById = async (id) => {
  const res = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
  return res.rows[0] || null;
};

/**
 * Checks for overlapping PENDING or APPROVED bookings for a resource.
 * Uses the overlap formula: newStart < existingEnd AND newEnd > existingStart (Rule B5).
 * Uses the provided pg client for atomic transactional locking (Rule B6).
 */
export const findOverlappingBookings = async (resourceId, startTime, endTime, client) => {
  const db = client || { query: (text, params) => query(text, params) };
  const res = await db.query(
    `SELECT id FROM bookings
     WHERE resource_id = $1
       AND status IN ('PENDING', 'APPROVED')
       AND start_time < $3
       AND end_time > $2`,
    [resourceId, startTime, endTime]
  );
  return res.rows;
};

/**
 * Counts future PENDING or APPROVED bookings for a user.
 * Used to enforce the max 3 active bookings per user rule (Rule B7).
 */
export const countActiveFutureBookingsByUser = async (userId, client) => {
  const db = client || { query: (text, params) => query(text, params) };
  const res = await db.query(
    `SELECT COUNT(*) FROM bookings
     WHERE user_id = $1
       AND status IN ('PENDING', 'APPROVED')
       AND start_time > NOW()`,
    [userId]
  );
  return parseInt(res.rows[0].count, 10);
};

/**
 * Atomically inserts a new booking within a transaction.
 * The caller must pass an acquired pg PoolClient for race-safe slot reservation (Rule B6).
 */
export const createBooking = async ({ resourceId, userId, ticketId, startTime, endTime, purpose, status = 'PENDING' }, client) => {
  const db = client || { query: (text, params) => query(text, params) };
  const res = await db.query(
    `INSERT INTO bookings (resource_id, user_id, ticket_id, start_time, end_time, purpose, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, resource_id AS "resourceId", user_id AS "userId",
               ticket_id AS "ticketId", start_time AS "startTime",
               end_time AS "endTime", purpose, status,
               decision_note AS "decisionNote", created_at AS "createdAt"`,
    [resourceId, userId, ticketId || null, startTime, endTime, purpose, status]
  );
  return res.rows[0];
};

/**
 * Paginated booking listing with optional filters.
 */
export const findBookings = async ({ userId, resourceId, status, from, to } = {}, { page = 1, limit = 10 } = {}) => {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (userId) { conditions.push(`b.user_id = $${idx++}`); values.push(userId); }
  if (resourceId) { conditions.push(`b.resource_id = $${idx++}`); values.push(resourceId); }
  if (status) { conditions.push(`b.status = $${idx++}`); values.push(status); }
  if (from) { conditions.push(`b.start_time >= $${idx++}`); values.push(from); }
  if (to) { conditions.push(`b.end_time <= $${idx++}`); values.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(`SELECT COUNT(*) FROM bookings b ${where}`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  values.push(limit, offset);
  const dataRes = await query(
    `${BOOKING_SELECT} ${where}
     ORDER BY b.start_time ASC LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return { data: dataRes.rows, total };
};

/**
 * Updates booking status and optional decision note.
 */
export const updateBookingStatus = async (id, status, decisionNote = null) => {
  const res = await query(
    `UPDATE bookings SET status = $1, decision_note = $2
     WHERE id = $3
     RETURNING id, resource_id AS "resourceId", user_id AS "userId",
               ticket_id AS "ticketId", start_time AS "startTime",
               end_time AS "endTime", purpose, status,
               decision_note AS "decisionNote", created_at AS "createdAt"`,
    [status, decisionNote, id]
  );
  return res.rows[0] || null;
};

/**
 * Returns blocked slot time ranges for a resource in a given date window.
 * Only PENDING and APPROVED bookings block slots (Rule B5).
 */
export const findBookedSlots = async (resourceId, from, to) => {
  const res = await query(
    `SELECT start_time AS "startTime", end_time AS "endTime", status
     FROM bookings
     WHERE resource_id = $1
       AND status IN ('PENDING', 'APPROVED')
       AND start_time < $3
       AND end_time > $2
     ORDER BY start_time ASC`,
    [resourceId, from, to]
  );
  return res.rows;
};

/**
 * Aggregated admin stats across active resources, booking statuses, and tickets.
 */
export const getBookingStats = async () => {
  const res = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDING')   AS "pendingCount",
      COUNT(*) FILTER (WHERE status = 'APPROVED')  AS "approvedCount",
      COUNT(*) FILTER (WHERE status = 'REJECTED')  AS "rejectedCount",
      COUNT(*) FILTER (WHERE status = 'CANCELLED') AS "cancelledCount",
      COUNT(*)                                      AS "totalCount"
    FROM bookings
  `);
  return res.rows[0];
};
