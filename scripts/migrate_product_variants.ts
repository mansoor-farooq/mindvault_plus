// One-off migration: adds product_variants (per-product size/color options with their own
// optional SKU/price override) plus an optional variant_id FK on stock_movements so a variant
// can carry its own stock. Safe to re-run (IF NOT EXISTS throughout).
// Run with: npx tsx scripts/migrate_product_variants.ts
import { db } from '../lib/db.server';

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      product_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(255),
      price_override DECIMAL(12,2),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_product_variants_user_id ON product_variants(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id)`);

  await db.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS variant_id VARCHAR(255)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON stock_movements(variant_id)`);

  console.log('Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
