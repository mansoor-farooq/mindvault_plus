// Database Migration for User Permission Gate (Layer 2)
// Run with: npx tsx --env-file=.env scripts/migrate_user_permission_gate.ts
import { db } from '../lib/db.server';
import crypto from 'crypto';

const CANONICAL_MODULES = [
  { moduleKey: 'pos', displayName: 'Point of Sale & Invoicing', category: 'SALES' },
  { moduleKey: 'khata', displayName: 'Customer Khata & Udhaar', category: 'SALES' },
  { moduleKey: 'inventory', displayName: 'Inventory & Warehouses', category: 'OPERATIONS' },
  { moduleKey: 'vendors', displayName: 'Vendors & Purchase Orders', category: 'OPERATIONS' },
  { moduleKey: 'factory', displayName: 'Factory BOM & Manufacturing', category: 'OPERATIONS' },
  { moduleKey: 'payroll', displayName: 'Staff & Payroll Management', category: 'HR' },
  { moduleKey: 'team_management', displayName: 'Team & Staff Roles Management', category: 'HR' },
  { moduleKey: 'roznamcha', displayName: 'Finance, Wallets & Expenses', category: 'FINANCE' },
  { moduleKey: 'budget', displayName: 'Budgets & Gulluck Savings', category: 'FINANCE' },
  { moduleKey: 'reports', displayName: 'Master Reports & P&L Analytics', category: 'EXECUTIVE' },
  { moduleKey: 'service_tracker', displayName: 'Rozana Periodic Service Tracker', category: 'OPERATIONS' },
  { moduleKey: 'notes_ai', displayName: 'AI Notes & Document Scanner', category: 'TOOLS' },
  { moduleKey: 'tools', displayName: 'Calculators, Tasks & Games', category: 'TOOLS' },
];

async function migrate() {
  console.log('Starting Layer 2 User Permission Gate Migration...');

  try {
    // 0. Add role_updated_at to users table for live session invalidation
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_updated_at TIMESTAMP DEFAULT NOW();
    `);

    try {
      await db.query(`ALTER TYPE license_type ADD VALUE IF NOT EXISTS 'STARTER'`);
    } catch (_) {}
    try {
      await db.query(`ALTER TYPE license_type ADD VALUE IF NOT EXISTS 'PRO_PLUS'`);
    } catch (_) {}
    try {
      await db.query(`ALTER TYPE license_type ADD VALUE IF NOT EXISTS 'ULTRA'`);
    } catch (_) {}

    // 1. module_definitions (System-seeded canonical catalog)
    await db.query(`
      CREATE TABLE IF NOT EXISTS module_definitions (
        id SERIAL PRIMARY KEY,
        module_key VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed canonical modules
    for (const mod of CANONICAL_MODULES) {
      await db.query(`
        INSERT INTO module_definitions (module_key, display_name, category)
        VALUES ($1, $2, $3)
        ON CONFLICT (module_key) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          category = EXCLUDED.category;
      `, [mod.moduleKey, mod.displayName, mod.category]);
    }
    console.log(`Seeded ${CANONICAL_MODULES.length} canonical module definitions.`);

    // 2. roles (Owner-defined dynamic roles + immutable default Owner)
    // Documented exception: business_id references users(id)
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        frontend_id VARCHAR(255) UNIQUE NOT NULL,
        business_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_system_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        CONSTRAINT uq_role_business_name UNIQUE (business_id, name)
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_roles_business_id ON roles(business_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_roles_frontend_id ON roles(frontend_id);`);

    // 3. role_module_permissions (Strictly validated)
    await db.query(`
      CREATE TABLE IF NOT EXISTS role_module_permissions (
        id SERIAL PRIMARY KEY,
        role_id VARCHAR(255) NOT NULL REFERENCES roles(frontend_id) ON DELETE CASCADE,
        module_key VARCHAR(50) NOT NULL REFERENCES module_definitions(module_key) ON DELETE CASCADE,
        access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('none', 'view', 'full')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_role_module UNIQUE (role_id, module_key)
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_role_module_role_id ON role_module_permissions(role_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_role_module_key ON role_module_permissions(module_key);`);

    // 4. user_role_assignments (Single active role per user per business)
    // Documented exception: user_id, business_id, assigned_by reference users(id)
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_role_assignments (
        id SERIAL PRIMARY KEY,
        frontend_id VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id VARCHAR(255) NOT NULL REFERENCES roles(frontend_id) ON DELETE CASCADE,
        business_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_user_business_assignment UNIQUE (user_id, business_id)
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_user_role_user_id ON user_role_assignments(user_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_user_role_business_id ON user_role_assignments(business_id);`);

    // 5. permission_audit_logs (Immutable audit trail)
    await db.query(`
      CREATE TABLE IF NOT EXISTS permission_audit_logs (
        id SERIAL PRIMARY KEY,
        frontend_id VARCHAR(255) UNIQUE NOT NULL,
        business_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_user_id INTEGER NOT NULL REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_permission_audit_business ON permission_audit_logs(business_id);`);

    // 6. Migration Step: Seed Immutable Default "Owner" Role For Every Existing Business
    const businessUsersRes = await db.query(`
      SELECT DISTINCT id FROM users 
      WHERE (org_role = 'OWNER' OR org_role IS NULL OR organization_id IS NULL)
    `);

    console.log(`Found ${businessUsersRes.rows.length} business owner accounts to seed default Owner role.`);

    for (const row of businessUsersRes.rows) {
      const businessId = row.id;

      // Check if Owner role already exists
      let roleRes = await db.query(
        `SELECT frontend_id FROM roles WHERE business_id = $1 AND name = 'Owner'`,
        [businessId]
      );

      let ownerRoleId: string;
      if (roleRes.rows.length === 0) {
        ownerRoleId = crypto.randomUUID();
        await db.query(`
          INSERT INTO roles (frontend_id, business_id, name, description, is_system_default)
          VALUES ($1, $2, 'Owner', 'Full immutable access to all unlocked modules', true)
        `, [ownerRoleId, businessId]);
      } else {
        ownerRoleId = roleRes.rows[0].frontend_id;
        await db.query(`
          UPDATE roles SET is_system_default = true WHERE frontend_id = $1
        `, [ownerRoleId]);
      }

      // Seed 'full' permissions on all 13 canonical modules for this Owner role
      for (const mod of CANONICAL_MODULES) {
        await db.query(`
          INSERT INTO role_module_permissions (role_id, module_key, access_level)
          VALUES ($1, $2, 'full')
          ON CONFLICT (role_id, module_key) DO UPDATE SET
            access_level = 'full',
            updated_at = NOW();
        `, [ownerRoleId, mod.moduleKey]);
      }

      // Assign the business user to this Owner role
      const assignmentId = crypto.randomUUID();
      await db.query(`
        INSERT INTO user_role_assignments (frontend_id, user_id, role_id, business_id, assigned_by)
        VALUES ($1, $2, $3, $2, $2)
        ON CONFLICT (user_id, business_id) DO UPDATE SET
          role_id = EXCLUDED.role_id,
          updated_at = NOW();
      `, [assignmentId, businessId, ownerRoleId]);
    }

    console.log('Layer 2 User Permission Gate Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error during migration:', err);
    process.exit(1);
  });
