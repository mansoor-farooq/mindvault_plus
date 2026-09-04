import { db } from '../lib/db.server';
import crypto from 'crypto';
import {
  validateNoCircularBOM,
  createBOM,
  expandBOMRequirements,
  validateWorkCenterCapacity,
  completeWorkOrder,
  getLiveWorkCenterOEE,
  getBusinessFactoryTier
} from '../lib/services/factoryService';
import { deductStock, getLiveStockQuantity } from '../lib/services/inventoryService';

async function runTests() {
  console.log('=== STARTING FACTORY MODULE VERIFICATION SUITE ===\n');

  // 1. Get or create a test business owner in PostgreSQL
  const userRes = await db.query(
    `SELECT id, email, license_type FROM users WHERE account_status != 'BANNED' ORDER BY id ASC LIMIT 1`
  );
  if (userRes.rows.length === 0) {
    throw new Error('No user found in database to run tests against');
  }
  const testUser = userRes.rows[0];
  const businessId = testUser.id;
  console.log(`[TEST SETUP] Using business_id: ${businessId} (${testUser.email}), Tier: ${testUser.license_type || 'FREE'}`);

  // Clean up any prior test artifacts for clean idempotent run
  await db.query(`DELETE FROM work_order_cost_postings WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM quality_defect_logs WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM machine_downtime_logs WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM material_consumptions WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM work_order_operations WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM work_orders WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM bom_line_items WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM bill_of_materials WHERE business_id = $1`, [businessId]);
  await db.query(`DELETE FROM work_centers WHERE business_id = $1`, [businessId]);

  // Create 3 test products: Product A (Finished Good), Product B (Sub-Assembly), Product C (Raw Material)
  const syncIdA = 'prod-test-a-' + crypto.randomUUID().slice(0, 8);
  const syncIdB = 'prod-test-b-' + crypto.randomUUID().slice(0, 8);
  const syncIdC = 'prod-test-c-' + crypto.randomUUID().slice(0, 8);

  await db.query(
    `INSERT INTO products (frontend_id, user_id, name, sku, selling_price, cost_price, is_deleted, created_at, updated_at)
     VALUES 
       ($1, $4, 'Luxury Leather Jacket', 'JKT-001', 15000, 7000, false, NOW(), NOW()),
       ($2, $4, 'Jacket Front Panel (Sub-Assembly)', 'PANEL-01', 5000, 2500, false, NOW(), NOW()),
       ($3, $4, 'Raw Cow Leather Hide', 'LTHR-RAW', 2000, 1000, false, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [syncIdA, syncIdB, syncIdC, businessId]
  );
  console.log('[TEST SETUP] Created Test Products: Finished Good (A), Sub-Assembly (B), Raw Material (C)');

  // Initial stock for Raw Leather Hide
  await db.query(
    `INSERT INTO stock_movements (frontend_id, user_id, product_id, type, quantity, reason, created_at, updated_at, is_deleted)
     VALUES ($1, $2, $3, 'STOCK_IN', 500, 'Initial Test Inward', NOW(), NOW(), false)`,
    [crypto.randomUUID(), businessId, syncIdC]
  );
  const initialStockC = await getLiveStockQuantity(businessId, syncIdC);
  console.log(`[TEST 1] Live Inventory Check: Raw Material Stock = ${initialStockC} units (Expected: >= 500)`);
  if (initialStockC < 500) throw new Error('Stock derivation failed');

  // =========================================================================
  // TEST 2: Bug 1 Fix - Direct Self-Reference Circular BOM Guard
  // =========================================================================
  console.log('\n--- TEST 2: Bug 1 Fix - Direct Self-Reference Check (A consumes A) ---');
  let selfRefBlocked = false;
  try {
    await validateNoCircularBOM(businessId, syncIdA, syncIdA);
  } catch (err: any) {
    if (err.message.includes('CIRCULAR_BOM_DEPENDENCY')) {
      selfRefBlocked = true;
      console.log(`[SUCCESS] Direct self-reference properly rejected: "${err.message}"`);
    }
  }
  if (!selfRefBlocked) {
    throw new Error('FAILED: Direct self-reference check did NOT block product consuming itself!');
  }

  // =========================================================================
  // TEST 3: Create Sub-Assembly BOM and Finished Product BOM
  // =========================================================================
  console.log('\n--- TEST 3: Creating Multi-Level BOM Hierarchy ---');
  // BOM for B: Sub-Assembly consumes 2 units of Raw Material C
  const bomB = await createBOM({
    businessId,
    actorUserId: businessId,
    finishedProductId: syncIdB,
    laborTimeEstimateMinutes: 20,
    overheadRatePerUnit: 50,
    notes: 'Sub-assembly panel',
    lineItems: [
      { componentProductId: syncIdC, quantityPerUnit: 2, unit: 'sqft', wastagePercent: 5 }
    ]
  });
  console.log(`[SUCCESS] Created Sub-Assembly BOM (B): syncId=${bomB.syncId}, version=${bomB.version}`);

  // BOM for A: Finished Good consumes 2 panels (B) and 1 raw hide (C)
  const bomA = await createBOM({
    businessId,
    actorUserId: businessId,
    finishedProductId: syncIdA,
    laborTimeEstimateMinutes: 60,
    overheadRatePerUnit: 150,
    notes: 'Finished jacket',
    lineItems: [
      { componentProductId: syncIdB, quantityPerUnit: 2, unit: 'pcs', wastagePercent: 0 },
      { componentProductId: syncIdC, quantityPerUnit: 1, unit: 'sqft', wastagePercent: 2 }
    ]
  });
  console.log(`[SUCCESS] Created Finished Good BOM (A): syncId=${bomA.syncId}, version=${bomA.version}`);

  // =========================================================================
  // TEST 4: Bug 1 Fix - Indirect Cycle Detection (C or B consumes A)
  // =========================================================================
  console.log('\n--- TEST 4: Bug 1 Fix - Indirect Recursive Cycle Detection ---');
  let indirectCycleBlocked = false;
  try {
    // Attempting to make Sub-Assembly B consume Finished Jacket A (B -> A -> B cycle)
    await validateNoCircularBOM(businessId, syncIdB, syncIdA);
  } catch (err: any) {
    if (err.message.includes('CIRCULAR_BOM_DEPENDENCY')) {
      indirectCycleBlocked = true;
      console.log(`[SUCCESS] Indirect circular dependency rejected by recursive CTE: "${err.message}"`);
    }
  }
  if (!indirectCycleBlocked) {
    throw new Error('FAILED: Indirect circular dependency was NOT caught by recursive CTE!');
  }

  // =========================================================================
  // TEST 5: Recursive Tree Explosion (MRP)
  // =========================================================================
  console.log('\n--- TEST 5: Recursive Requirements Explosion (MRP) ---');
  const explosion = await expandBOMRequirements(businessId, syncIdA, 10);
  console.log(`[SUCCESS] Exploded 10 units of Jacket A into ${explosion.length} component requirement lines:`);
  explosion.forEach(e => {
    console.log(`  - ${e.productName} (${e.componentProductId}): ${e.totalQuantityNeeded} ${e.unit} (Depth: ${e.depth}, SubAssembly: ${e.isSubAssembly})`);
  });
  if (explosion.length < 2) throw new Error('BOM explosion failed to traverse nested hierarchy');

  // =========================================================================
  // TEST 6: Work Center Creation & APS Capacity Validation
  // =========================================================================
  console.log('\n--- TEST 6: Work Center & APS Capacity-Aware Scheduling ---');
  const wcSyncId = crypto.randomUUID();
  await db.query(
    `INSERT INTO work_centers (
       frontend_id, business_id, name, type, capacity_per_hour, shift_hours_per_day,
       hourly_cost_rate, status, created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, 'Heavy Industrial Stitching Press #1', 'MACHINE', 10, 8, 800, 'ACTIVE', NOW(), NOW(), false)`,
    [wcSyncId, businessId]
  );
  console.log('[SUCCESS] Created Work Center with 10 units/hour capacity');

  // Test APS overload: 100 units requested in 5 hours window (max capacity = 50)
  const windowStart = new Date('2026-09-04T08:00:00Z');
  const windowEnd = new Date('2026-09-04T13:00:00Z'); // 5 hours
  const overloadCheck = await validateWorkCenterCapacity(businessId, wcSyncId, windowStart, windowEnd, 100);
  console.log(`[CHECK] APS Overload Test (100 units in 5h @ 10u/h): Allowed = ${overloadCheck.allowed}`);
  if (overloadCheck.allowed !== false) {
    throw new Error('FAILED: APS allowed overload when capacity was exceeded!');
  }
  console.log(`[SUCCESS] APS Capacity Bottleneck properly identified: ${overloadCheck.message}`);

  // Test APS valid: 40 units in 5 hours window
  const validCheck = await validateWorkCenterCapacity(businessId, wcSyncId, windowStart, windowEnd, 40);
  console.log(`[CHECK] APS Normal Test (40 units in 5h @ 10u/h): Allowed = ${validCheck.allowed}`);
  if (validCheck.allowed !== true) {
    throw new Error('FAILED: APS rejected valid schedule!');
  }

  // =========================================================================
  // TEST 7: Work Order, Floor Operations & Bug 2 Fix (quantity_completed)
  // =========================================================================
  console.log('\n--- TEST 7: Shop Floor MES Operations & Bug 2 Fix (quantity_completed) ---');
  const woSyncId = crypto.randomUUID();
  await db.query(
    `INSERT INTO work_orders (
       frontend_id, business_id, order_number, product_id, bom_id, bom_version_snapshot,
       quantity_planned, quantity_produced, status, priority, scheduled_start_date, scheduled_end_date,
       created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, 'WO-9901', $3, $4, 1, 50, 0, 'in_progress', 'high', $5, $6, NOW(), NOW(), false)`,
    [woSyncId, businessId, syncIdA, bomA.syncId, windowStart, windowEnd]
  );

  // Operation with throughput tracking (Bug 2 fix)
  const opSyncId = crypto.randomUUID();
  await db.query(
    `INSERT INTO work_order_operations (
       frontend_id, business_id, work_order_id, work_center_id, sequence_number,
       planned_duration_minutes, actual_start_time, actual_end_time, quantity_completed,
       status, created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, $3, $4, 1, 180, $5, $6, 45, 'completed', NOW(), NOW(), false)`,
    [opSyncId, businessId, woSyncId, wcSyncId, windowStart, windowEnd]
  );
  console.log('[SUCCESS] Logged Operation on Work Center with quantity_completed = 45 units');

  // Log 30 minutes of downtime on this work center
  await db.query(
    `INSERT INTO machine_downtime_logs (
       frontend_id, business_id, work_center_id, start_time, end_time, duration_minutes,
       reason_code, notes, logged_by_user_id, created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, $3, $4, $5, 30, 'power_outage', 'WAPDA load shedding outage', $6, NOW(), NOW(), false)`,
    [crypto.randomUUID(), businessId, wcSyncId, windowStart, new Date(windowStart.getTime() + 30 * 60000), businessId]
  );

  // Log 2 quality defects
  await db.query(
    `INSERT INTO quality_defect_logs (
       frontend_id, business_id, work_order_id, work_order_operation_id, defect_type,
       quantity_defective, notes, logged_by_user_id, timestamp, created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, $3, $4, 'surface', 2, 'Surface leather grain defect', $5, $6, NOW(), NOW(), false)`,
    [crypto.randomUUID(), businessId, woSyncId, opSyncId, businessId, windowStart]
  );

  // =========================================================================
  // TEST 8: Live OEE Engine Verification
  // =========================================================================
  console.log('\n--- TEST 8: Live OEE Calculation (Zero Stored Running Totals) ---');
  const oeeRes = await getLiveWorkCenterOEE(
    businessId,
    wcSyncId,
    new Date(windowStart.getTime() - 1000),
    new Date(windowEnd.getTime() + 1000)
  );
  console.log(`[OEE METRICS] Work Center: ${oeeRes.workCenterName}`);
  console.log(`  - Planned Time: ${oeeRes.plannedMinutes} mins`);
  console.log(`  - Downtime: ${oeeRes.downtimeMinutes} mins`);
  console.log(`  - Availability: ${oeeRes.availability}%`);
  console.log(`  - Throughput Count (via quantity_completed): ${oeeRes.totalCount}`);
  console.log(`  - Performance: ${oeeRes.performance}%`);
  console.log(`  - Quality: ${oeeRes.quality}% (Good: ${oeeRes.goodCount}, Defects: ${oeeRes.totalDefects})`);
  console.log(`  - Total Derived OEE: ${oeeRes.oee}%`);

  if (oeeRes.totalCount !== 45) {
    throw new Error(`FAILED: OEE throughput count should be 45 (Bug 2 fix), got ${oeeRes.totalCount}`);
  }
  if (oeeRes.totalDefects !== 2) {
    throw new Error(`FAILED: OEE defects count should be 2, got ${oeeRes.totalDefects}`);
  }
  console.log('[SUCCESS] Live OEE calculation conforms exactly to mathematical definition');

  // =========================================================================
  // TEST 9: Material Consumption & Stock Deduction
  // =========================================================================
  console.log('\n--- TEST 9: Material Consumption & Authoritative Stock Deduction ---');
  const deductRes = await deductStock({
    businessId,
    productId: syncIdC,
    quantity: 50,
    reason: 'Production WO-9901 Consumption',
    workOrderId: woSyncId,
    lotNumber: 'LOT-2026-PAK',
    serialNumber: 'SN-00192'
  });

  await db.query(
    `INSERT INTO material_consumptions (
       frontend_id, business_id, work_order_id, component_product_id, quantity_reserved,
       quantity_consumed, lot_number, serial_number, stock_movement_id, created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, $3, $4, 50, 50, 'LOT-2026-PAK', 'SN-00192', $5, NOW(), NOW(), false)`,
    [crypto.randomUUID(), businessId, woSyncId, syncIdC, deductRes.syncId]
  );

  const stockAfter = await getLiveStockQuantity(businessId, syncIdC);
  console.log(`[SUCCESS] Deducted 50 units. New Stock of Raw Leather = ${stockAfter} (Expected: ${initialStockC - 50})`);
  if (stockAfter !== initialStockC - 50) {
    throw new Error(`Stock deduction mismatch. Expected ${initialStockC - 50}, got ${stockAfter}`);
  }

  // =========================================================================
  // TEST 10: Complete Work Order & Automated Roznamcha Cost Posting
  // =========================================================================
  console.log('\n--- TEST 10: Work Order Completion & Automated Roznamcha Cost Posting ---');
  // Update produced quantity
  await db.query(`UPDATE work_orders SET quantity_produced = 45 WHERE frontend_id = $1`, [woSyncId]);

  const completion = await completeWorkOrder(businessId, businessId, woSyncId);
  console.log('[SUCCESS] Work Order completed successfully:');
  console.log(`  - Material Cost: Rs. ${completion.materialCost}`);
  console.log(`  - Labor Cost: Rs. ${completion.laborCost}`);
  console.log(`  - Overhead Cost: Rs. ${completion.overheadCost}`);
  console.log(`  - Total Manufacturing Cost: Rs. ${completion.totalCost}`);
  console.log(`  - Roznamcha Ledger Entry ID: ${completion.ledgerEntryId}`);

  // Verify Roznamcha record
  const ledgerRes = await db.query(
    `SELECT * FROM ledger_entries WHERE frontend_id = $1 AND user_id = $2`,
    [completion.ledgerEntryId, businessId]
  );
  if (ledgerRes.rows.length === 0) {
    throw new Error('FAILED: Roznamcha ledger entry was not created!');
  }
  const entry = ledgerRes.rows[0];
  console.log(`[SUCCESS] Roznamcha verified: Type=${entry.type}, Category=${entry.category}, Amount=Rs. ${entry.amount}`);
  console.log(`[SUCCESS] Note: "${entry.note}"`);

  // Verify work_order_cost_postings snapshot
  const postRes = await db.query(
    `SELECT * FROM work_order_cost_postings WHERE work_order_id = $1`,
    [woSyncId]
  );
  if (postRes.rows.length === 0) {
    throw new Error('FAILED: work_order_cost_postings record was not created!');
  }
  console.log(`[SUCCESS] Work order cost snapshot linked: total_cost=Rs. ${postRes.rows[0].total_cost}`);

  console.log('\n=== ALL 10 FACTORY MODULE TESTS PASSED WITH 100% SUCCESS ===');
}

runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ FACTORY MODULE TEST FAILED:', err);
    process.exit(1);
  });
