import { query } from '../config/db.js';

/**
 * Resource Repository - Functional data access layer for resources table.
 * All queries are parameterized for SQL injection safety (Rule T-B4).
 */

const RESOURCE_SELECT = `
  SELECT id, name, type, capacity, description,
         is_active AS "isActive", created_at AS "createdAt"
  FROM resources
`;

/**
 * Finds a resource by its UUID.
 */
export const findResourceById = async (id) => {
  const res = await query(`${RESOURCE_SELECT} WHERE id = $1`, [id]);
  return res.rows[0] || null;
};

/**
 * Case-insensitive resource name lookup (for uniqueness checks).
 */
export const findResourceByName = async (name) => {
  const res = await query(`${RESOURCE_SELECT} WHERE LOWER(name) = LOWER($1)`, [name]);
  return res.rows[0] || null;
};

/**
 * Paginated resource listing with optional filters.
 * USERs only see active resources (isActive = true).
 * ADMINs may see all resources.
 */
export const findResources = async ({ type, minCapacity, isActive, search } = {}, { page = 1, limit = 10 } = {}) => {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (isActive !== undefined) { conditions.push(`is_active = $${idx++}`); values.push(isActive); }
  if (type) { conditions.push(`type = $${idx++}`); values.push(type); }
  if (minCapacity !== undefined) { conditions.push(`capacity >= $${idx++}`); values.push(minCapacity); }
  if (search && search.trim()) {
    conditions.push(`name ILIKE $${idx++}`);
    values.push(`%${search.trim()}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await query(`SELECT COUNT(*) FROM resources ${where}`, values);
  const total = parseInt(countRes.rows[0].count, 10);

  values.push(limit, offset);
  const dataRes = await query(
    `${RESOURCE_SELECT} ${where} ORDER BY name ASC LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return { data: dataRes.rows, total };
};

/**
 * Inserts a new resource.
 */
export const createResource = async ({ name, type, capacity, description = null, isActive = true }) => {
  const res = await query(
    `INSERT INTO resources (name, type, capacity, description, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, type, capacity, description,
               is_active AS "isActive", created_at AS "createdAt"`,
    [name, type, capacity, description, isActive]
  );
  return res.rows[0];
};

/**
 * Updates a resource by ID with the given fields.
 */
export const updateResource = async (id, updates) => {
  const fieldMap = {
    name: 'name',
    type: 'type',
    capacity: 'capacity',
    description: 'description',
    isActive: 'is_active'
  };

  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, col] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      setClauses.push(`${col} = $${idx++}`);
      values.push(updates[key]);
    }
  }

  if (setClauses.length === 0) return findResourceById(id);

  values.push(id);
  const res = await query(
    `UPDATE resources SET ${setClauses.join(', ')} WHERE id = $${idx}
     RETURNING id, name, type, capacity, description,
               is_active AS "isActive", created_at AS "createdAt"`,
    values
  );
  return res.rows[0] || null;
};
