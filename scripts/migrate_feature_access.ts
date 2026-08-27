// One-off migration: adds user_feature_access, a per-user-per-feature override table
// (same (user_id, feature_key) shape as the existing feature_usage table). A row only
// exists when an admin has explicitly overridden a feature for that user; absence means
// "use the default" from lib/featureAccess.ts's FEATURE_ACCESS_CATALOG.
// Safe to re-run (IF NOT EXISTS throughout). Run with: npx tsx scripts/migrate_feature_access.ts
import { db } from '../lib/db.server';

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_feature_access (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      feature_key VARCHAR(50) NOT NULL,
      is_enabled BOOLEAN NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, feature_key)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_feature_access_user_id ON user_feature_access(user_id)`);

  console.log('Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
