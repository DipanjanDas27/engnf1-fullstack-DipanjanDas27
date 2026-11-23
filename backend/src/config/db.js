import pg from 'pg';
import dotenv from 'dotenv';
import { setDbPool as setUserRepoPool } from '../repositories/user.repository.js';

dotenv.config({ path: './.env' });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

// Determine if SSL is required (Neon serverless postgres requires SSL)
const isHostedDb = Boolean(
  process.env.NODE_ENV === 'production' ||
  (connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')))
);

export const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/triagesync',
  ssl: isHostedDb ? { rejectUnauthorized: false } : false,
  max: 20, // Concurrency pool limit
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Wire pool instance to repository layers
setUserRepoPool(pool);

/**
 * Execute a parameterized SQL query.
 *
 * @param {string} text - SQL query string
 * @param {Array} params - Parameterized values
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params = []) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
};

/**
 * Acquire a dedicated client from the pool for transactions.
 * Must call client.release() when finished.
 *
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Verifies the database connection on server startup.
 */
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL (Neon) database successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection error:', err.message);
    return false;
  }
};
