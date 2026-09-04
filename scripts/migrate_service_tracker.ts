import { db } from '../lib/db.server';

async function migrate() {
  console.log('Running Service Tracker Migration...');

  // 1. service_types
  await db.query(`
    CREATE TABLE IF NOT EXISTS service_types (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      company_code VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(50) NOT NULL DEFAULT 'fixed',
      default_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_service_types_user_id ON service_types(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_service_types_frontend_id ON service_types(frontend_id)`);

  // 2. service_subscriptions
  await db.query(`
    CREATE TABLE IF NOT EXISTS service_subscriptions (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      company_code VARCHAR(100),
      customer_id VARCHAR(255) NOT NULL,
      service_type_id VARCHAR(255) NOT NULL,
      start_date VARCHAR(50) NOT NULL,
      frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
      custom_days JSONB,
      agreed_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      default_quantity DECIMAL(10,2) DEFAULT 1.00,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_service_subscriptions_user_id ON service_subscriptions(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_service_subscriptions_customer_id ON service_subscriptions(customer_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_service_subscriptions_frontend_id ON service_subscriptions(frontend_id)`);

  // 3. delivery_logs
  await db.query(`
    CREATE TABLE IF NOT EXISTS delivery_logs (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      company_code VARCHAR(100),
      subscription_id VARCHAR(255) NOT NULL,
      date VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'received',
      quantity DECIMAL(10,2),
      marked_by VARCHAR(20) NOT NULL DEFAULT 'owner',
      marked_by_user_id VARCHAR(100),
      source VARCHAR(30) NOT NULL DEFAULT 'app',
      verification_token VARCHAR(100) UNIQUE,
      confirmed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      CONSTRAINT uq_delivery_sub_date UNIQUE (subscription_id, date)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_delivery_logs_sub_id ON delivery_logs(subscription_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_delivery_logs_date ON delivery_logs(date)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_delivery_logs_token ON delivery_logs(verification_token)`);

  console.log('Service Tracker Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
