/**
 * User Repository - Functional data access layer for PostgreSQL users table.
 */

let poolInstance = null;

export const setDbPool = (pool) => {
  poolInstance = pool;
};

/**
 * Finds a user by ID.
 * @param {string|number} id
 * @returns {Promise<Object|null>}
 */
export const findUserById = async (id) => {
  if (!poolInstance) return null;
  const res = await poolInstance.query(
    'SELECT id, name, email, role, created_at AS "createdAt" FROM users WHERE id = $1',
    [id]
  );
  return res.rows[0] || null;
};

/**
 * Finds a user by email (case-insensitive).
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export const findUserByEmail = async (email) => {
  if (!poolInstance) return null;
  const res = await poolInstance.query(
    'SELECT id, name, email, password_hash AS "passwordHash", role, created_at AS "createdAt" FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return res.rows[0] || null;
};

/**
 * Inserts a new user record.
 * @param {Object} userData
 * @returns {Promise<Object>}
 */
export const createUser = async ({ name, email, passwordHash, role = 'USER' }) => {
  if (!poolInstance) return null;
  const res = await poolInstance.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, LOWER($2), $3, $4) RETURNING id, name, email, role, created_at AS "createdAt"',
    [name, email, passwordHash, role]
  );
  return res.rows[0];
};
