import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes the schema.sql DDL migrations against the database.
 */
export const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running database schema migrations...');
    await pool.query(sql);
    console.log('Database schema successfully initialized with constraints and indexes.');
    return true;
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
    throw err;
  }
};

// Allow standalone execution: node src/config/initdb.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
