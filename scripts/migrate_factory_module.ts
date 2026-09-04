import { db } from '../lib/db.server';

async function migrateFactoryModule() {
  console.log('--- STARTING FACTORY MODULE (MRP/APS + MES) MIGRATION ---');

  // 1. Bill of Materials (BOM)
  await db.query(`
    CREATE TABLE IF NOT EXISTS bill_of_materials (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      finished_product_id VARCHAR(255) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      labor_time_estimate_minutes NUMERIC(10,2) DEFAULT 0,
      overhead_rate_per_unit NUMERIC(12,2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_bom_business_id ON bill_of_materials(business_id);
    CREATE INDEX IF NOT EXISTS idx_bom_finished_product_id ON bill_of_materials(finished_product_id);
    CREATE INDEX IF NOT EXISTS idx_bom_status ON bill_of_materials(status);
  `);
  console.log('✅ Created bill_of_materials table');

  // 2. BOM Line Items (Supports nested / multi-level sub-assemblies)
  await db.query(`
    CREATE TABLE IF NOT EXISTS bom_line_items (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      bom_id VARCHAR(255) NOT NULL REFERENCES bill_of_materials(frontend_id) ON DELETE CASCADE,
      component_product_id VARCHAR(255) NOT NULL,
      quantity_per_unit NUMERIC(12,4) NOT NULL,
      unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
      wastage_percent NUMERIC(5,2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_bom_line_items_bom_id ON bom_line_items(bom_id);
    CREATE INDEX IF NOT EXISTS idx_bom_line_items_component_id ON bom_line_items(component_product_id);
  `);
  console.log('✅ Created bom_line_items table');

  // 3. Work Centers (Machines / Production Lines)
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_centers (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'MACHINE',
      capacity_per_hour NUMERIC(10,2) NOT NULL DEFAULT 10,
      shift_hours_per_day NUMERIC(5,2) NOT NULL DEFAULT 8,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      hourly_cost_rate NUMERIC(12,2) DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_work_centers_business_id ON work_centers(business_id);
    CREATE INDEX IF NOT EXISTS idx_work_centers_status ON work_centers(status);
  `);
  console.log('✅ Created work_centers table');

  // 4. Work Orders
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      order_number VARCHAR(100) NOT NULL,
      product_id VARCHAR(255) NOT NULL,
      bom_id VARCHAR(255) NOT NULL REFERENCES bill_of_materials(frontend_id),
      bom_version_snapshot INTEGER NOT NULL,
      quantity_planned NUMERIC(12,2) NOT NULL,
      quantity_produced NUMERIC(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'planned',
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      scheduled_start_date TIMESTAMP WITH TIME ZONE,
      scheduled_end_date TIMESTAMP WITH TIME ZONE,
      actual_start_date TIMESTAMP WITH TIME ZONE,
      actual_end_date TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_work_orders_business_id ON work_orders(business_id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_product_id ON work_orders(product_id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
  `);
  console.log('✅ Created work_orders table');

  // 5. Work Order Operations (Routing with per-operation quantity_completed for accurate OEE)
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_order_operations (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      work_order_id VARCHAR(255) NOT NULL REFERENCES work_orders(frontend_id) ON DELETE CASCADE,
      work_center_id VARCHAR(255) NOT NULL REFERENCES work_centers(frontend_id),
      sequence_number INTEGER NOT NULL DEFAULT 1,
      planned_duration_minutes NUMERIC(10,2) NOT NULL DEFAULT 60,
      actual_start_time TIMESTAMP WITH TIME ZONE,
      actual_end_time TIMESTAMP WITH TIME ZONE,
      quantity_completed NUMERIC(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      operator_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_woo_work_order_id ON work_order_operations(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_woo_work_center_id ON work_order_operations(work_center_id);
    CREATE INDEX IF NOT EXISTS idx_woo_status ON work_order_operations(status);
  `);
  console.log('✅ Created work_order_operations table');

  // 6. Machine Downtime Logs (MES)
  await db.query(`
    CREATE TABLE IF NOT EXISTS machine_downtime_logs (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      work_center_id VARCHAR(255) NOT NULL REFERENCES work_centers(frontend_id),
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE,
      duration_minutes NUMERIC(10,2),
      reason_code VARCHAR(50) NOT NULL DEFAULT 'other',
      notes TEXT,
      logged_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_mdl_work_center_id ON machine_downtime_logs(work_center_id);
    CREATE INDEX IF NOT EXISTS idx_mdl_start_time ON machine_downtime_logs(start_time);
  `);
  console.log('✅ Created machine_downtime_logs table');

  // 7. Material Consumption (WMS / Inventory Link)
  await db.query(`
    CREATE TABLE IF NOT EXISTS material_consumptions (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      work_order_id VARCHAR(255) NOT NULL REFERENCES work_orders(frontend_id) ON DELETE CASCADE,
      component_product_id VARCHAR(255) NOT NULL,
      quantity_reserved NUMERIC(12,4) DEFAULT 0,
      quantity_consumed NUMERIC(12,4) NOT NULL DEFAULT 0,
      lot_number VARCHAR(100),
      serial_number VARCHAR(100),
      stock_movement_id VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_mc_work_order_id ON material_consumptions(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_mc_component_product_id ON material_consumptions(component_product_id);
  `);
  console.log('✅ Created material_consumptions table');

  // 8. Work Instructions (Quality / SOP)
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_instructions (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      bom_id VARCHAR(255),
      work_center_id VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      effective_date DATE DEFAULT CURRENT_DATE,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_wi_business_id ON work_instructions(business_id);
    CREATE INDEX IF NOT EXISTS idx_wi_bom_id ON work_instructions(bom_id);
    CREATE INDEX IF NOT EXISTS idx_wi_work_center_id ON work_instructions(work_center_id);
  `);
  console.log('✅ Created work_instructions table');

  // 9. Quality Defect Logs (MES / Inspection)
  await db.query(`
    CREATE TABLE IF NOT EXISTS quality_defect_logs (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      work_order_id VARCHAR(255) NOT NULL REFERENCES work_orders(frontend_id) ON DELETE CASCADE,
      work_order_operation_id VARCHAR(255),
      defect_type VARCHAR(50) NOT NULL DEFAULT 'other',
      quantity_defective NUMERIC(12,2) NOT NULL DEFAULT 1,
      lot_number VARCHAR(100),
      notes TEXT,
      logged_by_user_id INTEGER NOT NULL REFERENCES users(id),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_qdl_work_order_id ON quality_defect_logs(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_qdl_defect_type ON quality_defect_logs(defect_type);
  `);
  console.log('✅ Created quality_defect_logs table');

  // 10. Work Order Cost Postings (Financial Integration with Roznamcha)
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_order_cost_postings (
      id SERIAL PRIMARY KEY,
      frontend_id VARCHAR(255) UNIQUE NOT NULL,
      business_id INTEGER NOT NULL REFERENCES users(id),
      work_order_id VARCHAR(255) NOT NULL REFERENCES work_orders(frontend_id) ON DELETE CASCADE,
      material_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      labor_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      overhead_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      ledger_entry_id VARCHAR(255) NOT NULL,
      posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      posted_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_wocp_work_order_id ON work_order_cost_postings(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_wocp_ledger_entry_id ON work_order_cost_postings(ledger_entry_id);
  `);
  console.log('✅ Created work_order_cost_postings table');

  // 11. Add additive columns to stock_movements for lot/serial & work order traceability
  await db.query(`
    ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_number VARCHAR(100);
    ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
    ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS work_order_id VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_work_order_id ON stock_movements(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_lot_number ON stock_movements(lot_number);
  `);
  console.log('✅ Extended stock_movements with lot_number, serial_number, and work_order_id');

  console.log('🎉 FACTORY MODULE MIGRATION COMPLETED SUCCESSFULLY!');
}

migrateFactoryModule()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
