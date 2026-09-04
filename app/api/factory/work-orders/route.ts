import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { getBusinessFactoryTier, validateWorkCenterCapacity } from '@/lib/services/factoryService';
import crypto from 'crypto';

// GET /api/factory/work-orders - List all work orders
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');

    let query = `
      SELECT wo.*,
             p.name as product_name, p.sku as product_sku,
             b.version as current_bom_version,
             (SELECT COUNT(*) FROM work_order_operations woo WHERE woo.work_order_id = wo.frontend_id AND woo.is_deleted = false) as total_operations,
             (SELECT COUNT(*) FROM work_order_operations woo WHERE woo.work_order_id = wo.frontend_id AND woo.status = 'completed' AND woo.is_deleted = false) as completed_operations,
             (SELECT SUM(quantity_completed) FROM work_order_operations woo WHERE woo.work_order_id = wo.frontend_id AND woo.is_deleted = false) as current_operation_progress
      FROM work_orders wo
      JOIN products p ON p.frontend_id = wo.product_id
      LEFT JOIN bill_of_materials b ON b.frontend_id = wo.bom_id
      WHERE wo.business_id = $1 AND wo.is_deleted = false
    `;
    const params: any[] = [gate.businessId];

    if (statusFilter) {
      params.push(statusFilter);
      query += ` AND wo.status = $${params.length}`;
    }

    query += ` ORDER BY wo.created_at DESC`;

    const res = await db.query(query, params);
    return NextResponse.json({ workOrders: res.rows });
  } catch (err: any) {
    console.error('Error fetching work orders:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch work orders' }, { status: 500 });
  }
}

// POST /api/factory/work-orders - Create work order with APS capacity scheduling & version snapshotting
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const caps = await getBusinessFactoryTier(gate.businessId);

    // 1. Enforce monthly work order quota for tier
    const countRes = await db.query(
      `SELECT COUNT(*) as count FROM work_orders
       WHERE business_id = $1 
         AND created_at >= date_trunc('month', CURRENT_DATE) 
         AND is_deleted = false`,
      [gate.businessId]
    );
    const monthlyCount = Number(countRes.rows[0]?.count || 0);

    if (monthlyCount >= caps.maxMonthlyWorkOrders) {
      return NextResponse.json(
        {
          error: `Monthly work order limit reached (${caps.maxMonthlyWorkOrders} max for your current plan). Upgrade to ULTRA or LIFETIME for unlimited production planning.`
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      productId,
      bomId,
      quantityPlanned,
      priority = 'medium',
      scheduledStartDate,
      scheduledEndDate,
      notes,
      operations = [],
      allowOverload = false
    } = body;

    if (!productId || !bomId) {
      return NextResponse.json({ error: 'productId and bomId are required' }, { status: 400 });
    }
    const plannedQty = Number(quantityPlanned);
    if (!plannedQty || plannedQty <= 0) {
      return NextResponse.json({ error: 'quantityPlanned must be greater than 0' }, { status: 400 });
    }

    // 2. Fetch BOM and snapshot current version
    const bomRes = await db.query(
      `SELECT frontend_id, version, status FROM bill_of_materials
       WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
      [bomId, gate.businessId]
    );
    if (bomRes.rows.length === 0) {
      return NextResponse.json({ error: 'BOM not found' }, { status: 404 });
    }
    const bomSnapshotVersion = Number(bomRes.rows[0].version) || 1;

    // 3. APS Capacity Validation across operations
    if (scheduledStartDate && scheduledEndDate && operations.length > 0 && !allowOverload) {
      const sDate = new Date(scheduledStartDate);
      const eDate = new Date(scheduledEndDate);

      for (const op of operations) {
        if (op.workCenterId) {
          const capCheck = await validateWorkCenterCapacity(
            gate.businessId,
            op.workCenterId,
            sDate,
            eDate,
            plannedQty
          );
          if (!capCheck.allowed) {
            return NextResponse.json(
              {
                error: capCheck.message,
                capacityError: true,
                workCenterName: capCheck.workCenterName,
                maxCapacity: capCheck.maxCapacity,
                requestedQuantity: capCheck.requestedQuantity
              },
              { status: 422 }
            );
          }
        }
      }
    }

    // 4. Generate order number
    const seqRes = await db.query(
      `SELECT COUNT(*) as count FROM work_orders WHERE business_id = $1`,
      [gate.businessId]
    );
    const orderNumber = `WO-${1001 + Number(seqRes.rows[0]?.count || 0)}`;
    const woSyncId = crypto.randomUUID();

    // 5. Insert Work Order
    const woResult = await db.query(
      `INSERT INTO work_orders (
         frontend_id, business_id, order_number, product_id, bom_id,
         bom_version_snapshot, quantity_planned, quantity_produced, status,
         priority, scheduled_start_date, scheduled_end_date, notes,
         created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'planned', $8, $9, $10, $11, NOW(), NOW(), false)
       RETURNING *`,
      [
        woSyncId,
        gate.businessId,
        orderNumber,
        productId,
        bomId,
        bomSnapshotVersion,
        plannedQty,
        priority,
        scheduledStartDate ? new Date(scheduledStartDate) : null,
        scheduledEndDate ? new Date(scheduledEndDate) : null,
        notes || null
      ]
    );

    // 6. Insert Work Order Operations
    const createdOps: any[] = [];
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const opSyncId = crypto.randomUUID();
      const opRes = await db.query(
        `INSERT INTO work_order_operations (
           frontend_id, business_id, work_order_id, work_center_id,
           sequence_number, planned_duration_minutes, quantity_completed,
           status, created_at, updated_at, is_deleted
         )
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'pending', NOW(), NOW(), false)
         RETURNING *`,
        [
          opSyncId,
          gate.businessId,
          woSyncId,
          op.workCenterId,
          op.sequenceNumber || (i + 1),
          Number(op.plannedDurationMinutes) || 60
        ]
      );
      createdOps.push(opRes.rows[0]);
    }

    return NextResponse.json(
      {
        workOrder: woResult.rows[0],
        operations: createdOps
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error creating work order:', err);
    return NextResponse.json({ error: err.message || 'Failed to create work order' }, { status: 400 });
  }
}
