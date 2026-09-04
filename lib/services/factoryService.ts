import { db } from '../db.server';
import crypto from 'crypto';
import { deductStock } from './inventoryService';
import { getFactoryTierCapabilities } from '../config/gatingConfig';

export interface BOMLineItemInput {
  componentProductId: string;
  quantityPerUnit: number;
  unit?: string;
  wastagePercent?: number;
  notes?: string;
}

export interface CreateBOMParams {
  businessId: number;
  actorUserId: number;
  finishedProductId: string;
  laborTimeEstimateMinutes?: number;
  overheadRatePerUnit?: number;
  notes?: string;
  lineItems: BOMLineItemInput[];
}

export interface UpdateBOMParams {
  businessId: number;
  actorUserId: number;
  bomId: string;
  status?: 'draft' | 'active' | 'deprecated';
  laborTimeEstimateMinutes?: number;
  overheadRatePerUnit?: number;
  notes?: string;
  lineItems?: BOMLineItemInput[];
}

/**
 * Validates that adding a component to a finished product BOM does not create a circular dependency.
 * Checks both:
 * 1. Direct self-reference: componentProductId === finishedProductId (Bug 1 fix)
 * 2. Multi-level indirect cycle: component leads back to finished product via recursive CTE
 */
export async function validateNoCircularBOM(
  businessId: number,
  finishedProductId: string,
  componentProductId: string
): Promise<void> {
  // 1. Direct self-reference guard (Bug 1 Fix)
  if (componentProductId === finishedProductId) {
    throw new Error('CIRCULAR_BOM_DEPENDENCY: A product cannot be its own component.');
  }

  // 2. Multi-level indirect cycle check via PostgreSQL Recursive CTE
  const cycleCheckRes = await db.query(
    `WITH RECURSIVE bom_tree AS (
       -- Base case: find existing active/draft BOMs for the proposed component
       SELECT b.finished_product_id, bli.component_product_id, 1 AS depth,
              ARRAY[b.finished_product_id::text] AS path
       FROM bill_of_materials b
       JOIN bom_line_items bli ON bli.bom_id = b.frontend_id
       WHERE b.finished_product_id = $1
         AND b.business_id = $2
         AND b.status != 'deprecated'
         AND b.is_deleted = false
         AND bli.is_deleted = false

       UNION ALL

       -- Recursive case: traverse component BOMs
       SELECT next_b.finished_product_id, next_bli.component_product_id, bt.depth + 1,
              bt.path || next_b.finished_product_id::text
       FROM bom_tree bt
       JOIN bill_of_materials next_b ON next_b.finished_product_id = bt.component_product_id
       JOIN bom_line_items next_bli ON next_bli.bom_id = next_b.frontend_id
       WHERE next_b.business_id = $2
         AND next_b.status != 'deprecated'
         AND next_b.is_deleted = false
         AND next_bli.is_deleted = false
         AND NOT (next_b.finished_product_id::text = ANY(bt.path)) -- Prevent infinite loop
         AND bt.depth < 10 -- Hard ceiling
     )
     SELECT depth, path FROM bom_tree WHERE component_product_id = $3 LIMIT 1`,
    [componentProductId, businessId, finishedProductId]
  );

  if (cycleCheckRes.rows.length > 0) {
    const cycle = cycleCheckRes.rows[0];
    throw new Error(
      `CIRCULAR_BOM_DEPENDENCY: Circular reference detected. Component indirectly consumes parent product at depth ${cycle.depth}.`
    );
  }
}

/**
 * Creates a new Bill of Materials (BOM) with validated line items.
 */
export async function createBOM(params: CreateBOMParams) {
  const { businessId, finishedProductId, laborTimeEstimateMinutes, overheadRatePerUnit, notes, lineItems } = params;

  // Verify finished product exists
  const prodCheck = await db.query(
    'SELECT frontend_id, name FROM products WHERE frontend_id = $1 AND user_id = $2 AND is_deleted = false',
    [finishedProductId, businessId]
  );
  if (prodCheck.rows.length === 0) {
    throw new Error('Finished product not found for this business');
  }

  // Validate all line items for circular dependencies
  for (const item of lineItems) {
    await validateNoCircularBOM(businessId, finishedProductId, item.componentProductId);
  }

  const bomSyncId = crypto.randomUUID();

  // Insert BOM header
  await db.query(
    `INSERT INTO bill_of_materials (
       frontend_id, business_id, finished_product_id, version, status,
       labor_time_estimate_minutes, overhead_rate_per_unit, notes, created_at, updated_at
     )
     VALUES ($1, $2, $3, 1, 'active', $4, $5, $6, NOW(), NOW())`,
    [
      bomSyncId,
      businessId,
      finishedProductId,
      laborTimeEstimateMinutes || 0,
      overheadRatePerUnit || 0,
      notes || null
    ]
  );

  // Insert line items
  for (const item of lineItems) {
    const itemSyncId = crypto.randomUUID();
    await db.query(
      `INSERT INTO bom_line_items (
         frontend_id, business_id, bom_id, component_product_id,
         quantity_per_unit, unit, wastage_percent, notes, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        itemSyncId,
        businessId,
        bomSyncId,
        item.componentProductId,
        item.quantityPerUnit,
        item.unit || 'pcs',
        item.wastagePercent || 0,
        item.notes || null
      ]
    );
  }

  return { syncId: bomSyncId, finishedProductId, version: 1 };
}

/**
 * Updates a BOM by incrementing its version (never overwrites version in place for historical traceability).
 */
export async function updateBOM(params: UpdateBOMParams) {
  const { businessId, bomId, status, laborTimeEstimateMinutes, overheadRatePerUnit, notes, lineItems } = params;

  const currentBOM = await db.query(
    `SELECT * FROM bill_of_materials WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
    [bomId, businessId]
  );
  if (currentBOM.rows.length === 0) {
    throw new Error('BOM not found');
  }

  const bom = currentBOM.rows[0];
  const nextVersion = (Number(bom.version) || 1) + 1;

  if (lineItems && lineItems.length > 0) {
    for (const item of lineItems) {
      await validateNoCircularBOM(businessId, bom.finished_product_id, item.componentProductId);
    }

    // Soft-delete existing line items
    await db.query(
      `UPDATE bom_line_items SET is_deleted = true, deleted_at = NOW() WHERE bom_id = $1`,
      [bomId]
    );

    // Insert new line items
    for (const item of lineItems) {
      const itemSyncId = crypto.randomUUID();
      await db.query(
        `INSERT INTO bom_line_items (
           frontend_id, business_id, bom_id, component_product_id,
           quantity_per_unit, unit, wastage_percent, notes, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          itemSyncId,
          businessId,
          bomId,
          item.componentProductId,
          item.quantityPerUnit,
          item.unit || 'pcs',
          item.wastagePercent || 0,
          item.notes || null
        ]
      );
    }
  }

  await db.query(
    `UPDATE bill_of_materials SET
       version = $1,
       status = COALESCE($2, status),
       labor_time_estimate_minutes = COALESCE($3, labor_time_estimate_minutes),
       overhead_rate_per_unit = COALESCE($4, overhead_rate_per_unit),
       notes = COALESCE($5, notes),
       updated_at = NOW()
     WHERE frontend_id = $6`,
    [
      nextVersion,
      status || null,
      laborTimeEstimateMinutes !== undefined ? laborTimeEstimateMinutes : null,
      overheadRatePerUnit !== undefined ? overheadRatePerUnit : null,
      notes !== undefined ? notes : null,
      bomId
    ]
  );

  return { success: true, version: nextVersion };
}

/**
 * Multi-Level / Nested BOM Recursive Expansion.
 * Recursively explodes sub-assemblies to calculate total raw materials required for a planned production run.
 */
export async function expandBOMRequirements(
  businessId: number,
  finishedProductId: string,
  quantityToProduce: number
) {
  const result: Array<{
    componentProductId: string;
    productName: string;
    unit: string;
    totalQuantityNeeded: number;
    isSubAssembly: boolean;
    depth: number;
  }> = [];

  async function explode(productId: string, multiplier: number, depth: number) {
    if (depth > 10) return;

    // Look for active BOM for this product
    const bomRes = await db.query(
      `SELECT frontend_id FROM bill_of_materials
       WHERE finished_product_id = $1 AND business_id = $2 AND status = 'active' AND is_deleted = false
       ORDER BY version DESC LIMIT 1`,
      [productId, businessId]
    );

    if (bomRes.rows.length === 0) return;

    const bomSyncId = bomRes.rows[0].frontend_id;
    const linesRes = await db.query(
      `SELECT bli.component_product_id, bli.quantity_per_unit, bli.unit, bli.wastage_percent,
              p.name as product_name
       FROM bom_line_items bli
       JOIN products p ON p.frontend_id = bli.component_product_id
       WHERE bli.bom_id = $1 AND bli.is_deleted = false`,
      [bomSyncId]
    );

    for (const line of linesRes.rows) {
      const wastage = 1 + (Number(line.wastage_percent) || 0) / 100;
      const needed = Number(line.quantity_per_unit) * multiplier * wastage;

      // Check if this component has its own BOM (sub-assembly)
      const subBOM = await db.query(
        `SELECT 1 FROM bill_of_materials
         WHERE finished_product_id = $1 AND business_id = $2 AND status = 'active' AND is_deleted = false LIMIT 1`,
        [line.component_product_id, businessId]
      );

      const isSubAssembly = subBOM.rows.length > 0;

      result.push({
        componentProductId: line.component_product_id,
        productName: line.product_name,
        unit: line.unit,
        totalQuantityNeeded: Math.round(needed * 10000) / 10000,
        isSubAssembly,
        depth
      });

      if (isSubAssembly) {
        await explode(line.component_product_id, needed, depth + 1);
      }
    }
  }

  await explode(finishedProductId, quantityToProduce, 1);
  return result;
}

/**
 * Capacity-Aware Scheduling Validation (APS).
 * Flags or rejects scheduling if work center capacity is exceeded in the target window.
 */
export async function validateWorkCenterCapacity(
  businessId: number,
  workCenterId: string,
  startTime: Date,
  endTime: Date,
  plannedQuantity: number
) {
  const wcRes = await db.query(
    `SELECT name, capacity_per_hour, shift_hours_per_day, status FROM work_centers
     WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
    [workCenterId, businessId]
  );
  if (wcRes.rows.length === 0) throw new Error('Work center not found');

  const wc = wcRes.rows[0];
  if (wc.status !== 'ACTIVE') {
    throw new Error(`Work center "${wc.name}" is currently ${wc.status}`);
  }

  const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  if (durationHours <= 0) throw new Error('Scheduled end time must be strictly after start time');

  const maxUnitsInWindow = durationHours * Number(wc.capacity_per_hour);

  if (plannedQuantity > maxUnitsInWindow) {
    return {
      allowed: false,
      workCenterName: wc.name,
      maxCapacity: Math.floor(maxUnitsInWindow),
      requestedQuantity: plannedQuantity,
      message: `CAPACITY_OVERLOAD: Work center "${wc.name}" can only process ${Math.floor(maxUnitsInWindow)} units in this window (${durationHours.toFixed(1)} hrs @ ${wc.capacity_per_hour} units/hr).`
    };
  }

  return { allowed: true, workCenterName: wc.name, maxCapacity: maxUnitsInWindow };
}

/**
 * Work Order Completion & Automated Roznamcha Cost Posting.
 * Computes:
 * - Material cost (from material_consumptions x product cost_price)
 * - Labor cost (from work_order_operations actual duration x work_centers hourly_cost_rate)
 * - Overhead cost (quantityProduced x BOM overhead_rate_per_unit)
 * Posts as EXPENSE in ledger_entries and links to work_order_cost_postings.
 */
export async function completeWorkOrder(
  businessId: number,
  actorUserId: number,
  workOrderId: string
) {
  const woRes = await db.query(
    `SELECT wo.*, p.name as product_name, p.cost_price as default_cost_price,
            b.overhead_rate_per_unit
     FROM work_orders wo
     JOIN products p ON p.frontend_id = wo.product_id
     JOIN bill_of_materials b ON b.frontend_id = wo.bom_id
     WHERE wo.frontend_id = $1 AND wo.business_id = $2 AND wo.is_deleted = false`,
    [workOrderId, businessId]
  );
  if (woRes.rows.length === 0) throw new Error('Work order not found');

  const wo = woRes.rows[0];
  if (wo.status === 'completed') {
    throw new Error('Work order is already completed');
  }

  // 1. Calculate Material Cost
  const matRes = await db.query(
    `SELECT mc.quantity_consumed, COALESCE(p.cost_price, 0) as unit_cost
     FROM material_consumptions mc
     JOIN products p ON p.frontend_id = mc.component_product_id
     WHERE mc.work_order_id = $1 AND mc.is_deleted = false`,
    [workOrderId]
  );

  let materialCost = 0;
  for (const m of matRes.rows) {
    materialCost += Number(m.quantity_consumed) * Number(m.unit_cost);
  }

  // 2. Calculate Labor Cost
  const opsRes = await db.query(
    `SELECT woo.actual_start_time, woo.actual_end_time, woo.planned_duration_minutes,
            COALESCE(wc.hourly_cost_rate, 0) as hourly_rate
     FROM work_order_operations woo
     JOIN work_centers wc ON wc.frontend_id = woo.work_center_id
     WHERE woo.work_order_id = $1 AND woo.is_deleted = false`,
    [workOrderId]
  );

  let laborCost = 0;
  for (const op of opsRes.rows) {
    let durationMinutes = Number(op.planned_duration_minutes) || 60;
    if (op.actual_start_time && op.actual_end_time) {
      durationMinutes = (new Date(op.actual_end_time).getTime() - new Date(op.actual_start_time).getTime()) / (1000 * 60);
    }
    laborCost += (Math.max(0, durationMinutes) / 60) * Number(op.hourly_rate);
  }

  // 3. Calculate Overhead Cost
  const producedQty = Number(wo.quantity_produced) || Number(wo.quantity_planned);
  const overheadCost = producedQty * Number(wo.overhead_rate_per_unit || 0);

  const totalCost = Math.round((materialCost + laborCost + overheadCost) * 100) / 100;

  // 4. Post into Roznamcha (ledger_entries)
  const ledgerSyncId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const note = `Production Cost for WO-${wo.order_number} (${wo.product_name} x ${producedQty}): Mat=Rs.${materialCost.toFixed(0)}, Labor=Rs.${laborCost.toFixed(0)}, Overhead=Rs.${overheadCost.toFixed(0)}`;

  await db.query(
    `INSERT INTO ledger_entries (
       frontend_id, user_id, type, amount, category, note, date, is_recurring, created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, 'EXPENSE', $3, 'MANUFACTURING_COST', $4, $5, false, NOW(), NOW(), false)`,
    [ledgerSyncId, businessId, totalCost, note, today]
  );

  // 5. Insert work_order_cost_postings snapshot
  const costPostingSyncId = crypto.randomUUID();
  await db.query(
    `INSERT INTO work_order_cost_postings (
       frontend_id, business_id, work_order_id, material_cost, labor_cost,
       overhead_cost, total_cost, ledger_entry_id, posted_at, posted_by_user_id,
       created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, NOW(), NOW(), false)`,
    [
      costPostingSyncId,
      businessId,
      workOrderId,
      materialCost,
      laborCost,
      overheadCost,
      totalCost,
      ledgerSyncId,
      actorUserId
    ]
  );

  // 6. Update Work Order status to completed
  await db.query(
    `UPDATE work_orders SET
       status = 'completed',
       quantity_produced = $1,
       actual_end_date = NOW(),
       updated_at = NOW()
     WHERE frontend_id = $2`,
    [producedQty, workOrderId]
  );

  return {
    success: true,
    workOrderId,
    totalCost,
    materialCost,
    laborCost,
    overheadCost,
    ledgerEntryId: ledgerSyncId
  };
}

/**
 * Live OEE Query Engine (Zero Stored Running Totals).
 * Computes Availability, Performance, Quality, and OEE per Work Center for a given shift window.
 * Bug 2 Fix: Uses operation-level `quantity_completed` rather than top-level work order quantity.
 */
export async function getLiveWorkCenterOEE(
  businessId: number,
  workCenterId: string,
  windowStart: Date,
  windowEnd: Date
) {
  // 1. Fetch work center details
  const wcRes = await db.query(
    `SELECT frontend_id, name, capacity_per_hour, shift_hours_per_day
     FROM work_centers
     WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
    [workCenterId, businessId]
  );
  if (wcRes.rows.length === 0) throw new Error('Work center not found');
  const wc = wcRes.rows[0];

  const plannedHours = Math.max(0.1, (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60));
  const plannedMinutes = plannedHours * 60;

  // 2. Fetch Downtime in window
  const dtRes = await db.query(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total_downtime
     FROM machine_downtime_logs
     WHERE work_center_id = $1 AND business_id = $2
       AND start_time >= $3 AND start_time <= $4
       AND is_deleted = false`,
    [workCenterId, businessId, windowStart, windowEnd]
  );
  const downtimeMinutes = Number(dtRes.rows[0]?.total_downtime || 0);

  // RunTime
  const runTimeMinutes = Math.max(0, plannedMinutes - downtimeMinutes);
  const availability = plannedMinutes > 0 ? Math.min(1, runTimeMinutes / plannedMinutes) : 0;

  // 3. Performance: Throughput via operation-level quantity_completed (Bug 2 Fix)
  const opsRes = await db.query(
    `SELECT COALESCE(SUM(quantity_completed), 0) as total_count
     FROM work_order_operations
     WHERE work_center_id = $1 AND business_id = $2
       AND (
         (actual_start_time >= $3 AND actual_start_time <= $4) OR
         (updated_at >= $3 AND updated_at <= $4 AND status = 'completed')
       )
       AND is_deleted = false`,
    [workCenterId, businessId, windowStart, windowEnd]
  );
  const totalCount = Number(opsRes.rows[0]?.total_count || 0);

  const capacityPerHour = Number(wc.capacity_per_hour) || 10;
  const idealCycleTimeMinutes = 60 / capacityPerHour; // Ideal minutes per unit

  let performance = 0;
  if (runTimeMinutes > 0 && totalCount > 0) {
    performance = Math.min(1.2, (idealCycleTimeMinutes * totalCount) / runTimeMinutes);
  }

  // 4. Quality: Exclude defects logged on work orders at this work center
  const defectsRes = await db.query(
    `SELECT COALESCE(SUM(qdl.quantity_defective), 0) as total_defects
     FROM quality_defect_logs qdl
     JOIN work_order_operations woo ON woo.work_order_id = qdl.work_order_id
     WHERE woo.work_center_id = $1 AND qdl.business_id = $2
       AND qdl.timestamp >= $3 AND qdl.timestamp <= $4
       AND qdl.is_deleted = false`,
    [workCenterId, businessId, windowStart, windowEnd]
  );
  const totalDefects = Number(defectsRes.rows[0]?.total_defects || 0);

  const goodCount = Math.max(0, totalCount - totalDefects);
  const quality = totalCount > 0 ? Math.max(0, goodCount / totalCount) : 1;

  // 5. Final OEE
  const oee = Math.round(availability * performance * quality * 1000) / 10; // As percentage e.g. 78.5%

  return {
    workCenterId,
    workCenterName: wc.name,
    capacityPerHour,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    plannedMinutes: Math.round(plannedMinutes),
    downtimeMinutes: Math.round(downtimeMinutes),
    runTimeMinutes: Math.round(runTimeMinutes),
    totalCount,
    totalDefects,
    goodCount,
    availability: Math.round(availability * 1000) / 10,
    performance: Math.round(performance * 1000) / 10,
    quality: Math.round(quality * 1000) / 10,
    oee: Math.min(100, oee)
  };
}

/**
 * Retrieves the factory capabilities for a given business based on its user license_type.
 */
export async function getBusinessFactoryTier(businessId: number) {
  const res = await db.query('SELECT license_type FROM users WHERE id = $1', [businessId]);
  const licenseType = (res.rows[0]?.license_type as string) || 'FREE';
  return getFactoryTierCapabilities(licenseType);
}
