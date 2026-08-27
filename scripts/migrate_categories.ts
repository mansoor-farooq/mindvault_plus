// One-off migration: adds a self-referencing categories table (unlimited-depth tree via
// parent_id) plus an optional category_id FK on products. Safe to re-run (IF NOT EXISTS
// throughout). Run with: npx tsx scripts/migrate_categories.ts
import { db } from '../lib/db.server';

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      parent_id VARCHAR(255),
      icon VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id)`);

  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id VARCHAR(255)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`);

  console.log('Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
