import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';

// GET /api/factory/work-orders/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;

    // 1. Fetch work order header
    const woRes = await db.query(
      `SELECT wo.*,
              p.name as product_name, p.sku as product_sku, p.selling_price as product_price,
              b.version as current_bom_version, b.notes as bom_notes
       FROM work_orders wo
       JOIN products p ON p.frontend_id = wo.product_id
       LEFT JOIN bill_of_materials b ON b.frontend_id = wo.bom_id
       WHERE wo.frontend_id = $1 AND wo.business_id = $2 AND wo.is_deleted = false`,
      [id, gate.businessId]
    );

    if (woRes.rows.length === 0) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    const workOrder = woRes.rows[0];

    // 2. Fetch operations
    const opsRes = await db.query(
      `SELECT woo.*, wc.name as work_center_name, wc.type as work_center_type, wc.capacity_per_hour
       FROM work_order_operations woo
       JOIN work_centers wc ON wc.frontend_id = woo.work_center_id
       WHERE woo.work_order_id = $1 AND woo.is_deleted = false
       ORDER BY woo.sequence_number ASC`,
      [id]
    );

    // 3. Fetch material consumptions
    const matsRes = await db.query(
      `SELECT mc.*, p.name as component_name, p.sku as component_sku, p.cost_price as component_cost_price
       FROM material_consumptions mc
       JOIN products p ON p.frontend_id = mc.component_product_id
       WHERE mc.work_order_id = $1 AND mc.is_deleted = false
       ORDER BY mc.created_at ASC`,
      [id]
    );

    // 4. Fetch quality defects
    const defectsRes = await db.query(
      `SELECT qdl.*, u.name as logged_by_name
       FROM quality_defect_logs qdl
       LEFT JOIN users u ON u.id = qdl.logged_by_user_id
       WHERE qdl.work_order_id = $1 AND qdl.is_deleted = false
       ORDER BY qdl.timestamp DESC`,
      [id]
    );

    // 5. Fetch cost postings if completed
    const costRes = await db.query(
      `SELECT wocp.*, le.frontend_id as roznamcha_sync_id, le.amount as posted_ledger_amount, le.category as posted_ledger_category
       FROM work_order_cost_postings wocp
       LEFT JOIN ledger_entries le ON le.frontend_id = wocp.ledger_entry_id
       WHERE wocp.work_order_id = $1 AND wocp.is_deleted = false`,
      [id]
    );

    return NextResponse.json({
      workOrder,
      operations: opsRes.rows,
      materialConsumptions: matsRes.rows,
      defectLogs: defectsRes.rows,
      costPosting: costRes.rows[0] || null
    });
  } catch (err: any) {
    console.error('Error fetching work order detail:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch work order detail' }, { status: 500 });
  }
}
