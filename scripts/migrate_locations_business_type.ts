// One-off migration: adds business_type to users, a new locations table, optional
// location_id FKs on products/stock_movements/khata_customers, and delivery_cost/
// delivery_note on stock_movements. Safe to re-run (IF NOT EXISTS throughout, so no
// explicit transaction wrapper is needed - a partial failure just leaves already-applied
// statements in place and a re-run picks up where it left off).
// Run with: npx tsx scripts/migrate_locations_business_type.ts
import { db } from '../lib/db.server';

async function migrate() {
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_type VARCHAR(30)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      location_type VARCHAR(20) DEFAULT 'BRANCH',
      address TEXT,
      city VARCHAR(100),
      is_active BOOLEAN DEFAULT true,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id)`);

  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS location_id VARCHAR(255)`);
  await db.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS location_id VARCHAR(255)`);
  await db.query(`ALTER TABLE khata_customers ADD COLUMN IF NOT EXISTS location_id VARCHAR(255)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_products_location_id ON products(location_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_location_id ON stock_movements(location_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_khata_customers_location_id ON khata_customers(location_id)`);

  await db.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(10,2)`);
  await db.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS delivery_note VARCHAR(255)`);

  console.log('Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
