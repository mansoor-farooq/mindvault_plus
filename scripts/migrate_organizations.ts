// One-off migration: adds organizations (owner_user_id) plus account_type/organization_id/
// org_role on users. Individual accounts (the default, unchanged behavior) have
// organization_id/org_role left NULL. Safe to re-run (IF NOT EXISTS throughout).
// Run with: npx tsx scripts/migrate_organizations.ts
import { db } from '../lib/db.server';

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      owner_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'INDIVIDUAL'`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role VARCHAR(20)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)`);

  console.log('Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
