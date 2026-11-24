import { getClient, query } from '../config/db.js';
import {
  findBookingById,
  findBookings as findBookingsInDb,
  findOverlappingBookings,
  countActiveFutureBookingsByUser,
  createBooking as createBookingInDb,
  updateBookingStatus,
  findBookedSlots,
  getBookingStats
} from '../repositories/booking.repository.js';
import { findResourceById } from '../repositories/resource.repository.js';
import { getTicketStats } from '../repositories/ticket.repository.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Validates grid timing and duration constraints (Rules B1–B4).
 */
export const validateGridAndTiming = (startTimeStr, endTimeStr) => {
  const start = new Date(startTimeStr);
  const end = new Date(endTimeStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw ApiError.validationError('startTime and endTime must be valid ISO 8601 UTC date strings');
  }

  // Must fall on 00 or 30 minutes with 0s and 0ms
  if (
    start.getUTCSeconds() !== 0 ||
    start.getUTCMilliseconds() !== 0 ||
    ![0, 30].includes(start.getUTCMinutes())
  ) {
    throw ApiError.validationError('startTime must fall on :00 or :30 minutes with 0s/0ms (UTC)');
  }

  if (
    end.getUTCSeconds() !== 0 ||
    end.getUTCMilliseconds() !== 0 ||
    ![0, 30].includes(end.getUTCMinutes())
  ) {
    throw ApiError.validationError('endTime must fall on :00 or :30 minutes with 0s/0ms (UTC)');
  }

  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (durationMinutes < 30 || durationMinutes > 240) {
    throw ApiError.validationError('Booking duration must be between 30 and 240 minutes inclusive');
  }

  const now = Date.now();
  if (start.getTime() <= now) {
    throw ApiError.validationError('startTime must be in the future');
  }

  const thirtyDaysAhead = now + 30 * 24 * 60 * 60 * 1000;
  if (start.getTime() > thirtyDaysAhead) {
    throw ApiError.validationError('startTime must be at most 30 days ahead');
  }

  return { start, end };
};

/**
 * Creates a resource booking with atomic concurrency protection (Rule B6).
 * Uses row-level locks (SELECT ... FOR UPDATE) and PostgreSQL exclusion constraints.
 * 10 simultaneous requests for the same slot yield exactly 1 201 and 9 409s.
 */
export const createBooking = async (userId, { resourceId, startTime, endTime, purpose, ticketId }) => {
  if (!purpose || purpose.trim().length < 5 || purpose.trim().length > 200) {
    throw ApiError.validationError('Booking purpose must be between 5 and 200 characters');
  }

  const { start, end } = validateGridAndTiming(startTime, endTime);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Lock the parent resource row to serialize slot checks on this resource
    const resourceRes = await client.query(
      'SELECT id, is_active AS "isActive" FROM resources WHERE id = $1 FOR UPDATE',
      [resourceId]
    );

    if (resourceRes.rows.length === 0) {
      throw ApiError.notFound(`Resource with ID ${resourceId} not found`);
    }

    if (!resourceRes.rows[0].isActive) {
      throw ApiError.conflict('Cannot book an inactive resource');
    }

    // 2. Enforce max 3 future active bookings per user (Rule B7)
    const activeCount = await countActiveFutureBookingsByUser(userId, client);
    if (activeCount >= 3) {
      throw ApiError.conflict('User has reached the limit of 3 active future bookings');
    }

    // 3. Check for overlapping PENDING or APPROVED bookings (Rule B5)
    const overlapping = await findOverlappingBookings(resourceId, startIso, endIso, client);
    if (overlapping.length > 0) {
      throw ApiError.conflict('Requested time slot overlaps with an existing booking');
    }

    // 4. Insert booking atomically
    const booking = await createBookingInDb(
      {
        resourceId,
        userId,
        ticketId: ticketId || null,
        startTime: startIso,
        endTime: endIso,
        purpose: purpose.trim(),
        status: 'PENDING'
      },
      client
    );

    await client.query('COMMIT');
    return booking;
  } catch (err) {
    await client.query('ROLLBACK');

    // Handle PostgreSQL exclusion constraint violation (code 23P01)
    if (err.code === '23P01') {
      throw ApiError.conflict('Requested time slot overlaps with an existing booking');
    }

    throw err;
  } finally {
    client.release();
  }
};

/**
 * Retrieves slot availability for a resource within a 7-day range (Endpoint 13).
 * Reveals only startTime, endTime, and status for privacy (Rule B14).
 */
export const getAvailability = async (resourceId, from, to) => {
  const resource = await findResourceById(resourceId);
  if (!resource) {
    throw ApiError.notFound(`Resource with ID ${resourceId} not found`);
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw ApiError.validationError('from and to must be valid ISO 8601 date strings');
  }

  const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0 || diffDays > 7) {
    throw ApiError.validationError('Availability query window must be between 0 and 7 days');
  }

  const bookedSlots = await findBookedSlots(resourceId, fromDate.toISOString(), toDate.toISOString());

  return {
    resourceId,
    from,
    to,
    bookings: bookedSlots.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status
    }))
  };
};

/**
 * Retrieves bookings for the logged-in user (Endpoint 15).
 */
export const getMyBookings = async (userId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return findBookingsInDb({ userId, status: query.status }, { page, limit: 10 });
};

/**
 * Retrieves all bookings across resources (ADMIN only, Endpoint 17).
 */
export const getAllBookings = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const { status, resourceId, from, to } = query;

  if ((from && !to) || (!from && to)) {
    throw ApiError.validationError('Both from and to query parameters are required for date filtering');
  }

  return findBookingsInDb({ status, resourceId, from, to }, { page, limit: 10 });
};

/**
 * Retrieves a single booking by ID with ownership enforcement (Endpoint 16).
 */
export const getBookingById = async (id, user) => {
  const booking = await findBookingById(id);
  if (!booking) {
    throw ApiError.notFound(`Booking with ID ${id} not found`);
  }

  // USER can only read their own bookings (Rule B12)
  if (user.role !== 'ADMIN' && booking.userId !== user.id) {
    throw ApiError.forbidden('You do not have permission to view this booking');
  }

  return booking;
};

/**
 * Cancels a booking (Owner only, Endpoint 18).
 */
export const cancelBooking = async (id, user) => {
  const booking = await findBookingById(id);
  if (!booking) {
    throw ApiError.notFound(`Booking with ID ${id} not found`);
  }

  if (booking.userId !== user.id) {
    throw ApiError.forbidden('You can only cancel your own bookings');
  }

  if (!['PENDING', 'APPROVED'].includes(booking.status)) {
    throw ApiError.conflict(`Cannot cancel a booking with status ${booking.status}`);
  }

  if (new Date(booking.startTime).getTime() <= Date.now()) {
    throw ApiError.conflict('Cannot cancel a booking that has already started');
  }

  return updateBookingStatus(id, 'CANCELLED');
};

/**
 * Approves a pending booking (ADMIN only, Endpoint 19).
 */
export const approveBooking = async (id) => {
  const booking = await findBookingById(id);
  if (!booking) {
    throw ApiError.notFound(`Booking with ID ${id} not found`);
  }

  if (booking.status !== 'PENDING') {
    throw ApiError.conflict(`Cannot approve booking with status ${booking.status}`);
  }

  if (new Date(booking.startTime).getTime() <= Date.now()) {
    throw ApiError.conflict('Cannot approve a booking in the past');
  }

  return updateBookingStatus(id, 'APPROVED');
};

/**
 * Rejects a pending booking with a mandatory note (ADMIN only, Endpoint 20).
 */
export const rejectBooking = async (id, note) => {
  if (!note || note.trim().length < 5 || note.trim().length > 200) {
    throw ApiError.validationError('Rejection note is required and must be between 5 and 200 characters');
  }

  const booking = await findBookingById(id);
  if (!booking) {
    throw ApiError.notFound(`Booking with ID ${id} not found`);
  }

  if (booking.status !== 'PENDING') {
    throw ApiError.conflict(`Cannot reject booking with status ${booking.status}`);
  }

  if (new Date(booking.startTime).getTime() <= Date.now()) {
    throw ApiError.conflict('Cannot reject a booking in the past');
  }

  return updateBookingStatus(id, 'REJECTED', note.trim());
};

/**
 * Aggregates analytical statistics for the admin dashboard (Endpoint 21).
 */
export const getAdminStats = async () => {
  const [resourceCountRes, bookingStats, topResourcesRes, ticketStatsRaw] = await Promise.all([
    query('SELECT COUNT(*) FROM resources WHERE is_active = TRUE'),
    getBookingStats(),
    query(`
      SELECT r.id, r.name, r.type, COUNT(b.id) AS "bookingCount"
      FROM resources r
      LEFT JOIN bookings b ON b.resource_id = r.id
      GROUP BY r.id, r.name, r.type
      ORDER BY "bookingCount" DESC
      LIMIT 3
    `),
    getTicketStats()
  ]);

  return {
    activeResources: parseInt(resourceCountRes.rows[0].count, 10),
    bookingsByStatus: {
      PENDING: parseInt(bookingStats.pendingCount, 10) || 0,
      APPROVED: parseInt(bookingStats.approvedCount, 10) || 0,
      REJECTED: parseInt(bookingStats.rejectedCount, 10) || 0,
      CANCELLED: parseInt(bookingStats.cancelledCount, 10) || 0
    },
    topResources: topResourcesRes.rows,
    ticketStats: {
      total: parseInt(ticketStatsRaw.totalCount, 10) || 0,
      reviewed: parseInt(ticketStatsRaw.reviewedCount, 10) || 0,
      modelAgreementRate: parseFloat(ticketStatsRaw.modelAgreementRate) || 0
    }
  };
};
