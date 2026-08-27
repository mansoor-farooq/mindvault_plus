// Server-only Postgres pool - port of backend/src/config/db.js.
// Named db.server.ts (not db.ts) to avoid any confusion with the existing
// client-side Dexie db at lib/db.ts, which is a completely different thing
// (local IndexedDB) despite the similar name.
import { Pool } from 'pg';

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('$DB_NAME')) {
  connectionString = connectionString.replace('$DB_NAME', process.env.DB_NAME || 'mindvault');
}

const pool = new Pool({
  connectionString:
    connectionString ||
    `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'mindvault'}`,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
    return;
  }
  console.log('Database connected successfully');
  release();
});

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
};
