import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { completeWorkOrder } from '@/lib/services/factoryService';

// PUT /api/factory/work-orders/[id]/status - Work Order state machine transition
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, quantityProduced } = body;

    const validStatuses = ['planned', 'released', 'in_progress', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch existing work order
    const woRes = await db.query(
      `SELECT * FROM work_orders WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
      [id, gate.businessId]
    );
    if (woRes.rows.length === 0) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    const currentWO = woRes.rows[0];

    // If already completed or cancelled, prevent re-transition
    if (currentWO.status === 'completed' && status !== 'completed') {
      return NextResponse.json({ error: 'Completed work order cannot change status' }, { status: 400 });
    }
    if (currentWO.status === 'cancelled') {
      return NextResponse.json({ error: 'Cancelled work order cannot change status' }, { status: 400 });
    }

    // Optional: update quantityProduced if passed
    if (quantityProduced !== undefined && Number(quantityProduced) >= 0) {
      await db.query(
        `UPDATE work_orders SET quantity_produced = $1, updated_at = NOW() WHERE frontend_id = $2`,
        [Number(quantityProduced), id]
      );
    }

    // Special Transition: Completed -> calls completeWorkOrder to trigger Roznamcha posting
    if (status === 'completed') {
      const completionResult = await completeWorkOrder(
        gate.businessId,
        gate.actualUserId,
        id
      );
      return NextResponse.json({
        success: true,
        status: 'completed',
        costPosting: completionResult
      });
    }

    // Other transitions: planned, released, in_progress, cancelled
    let updateQuery = `UPDATE work_orders SET status = $1, updated_at = NOW()`;
    const queryParams: any[] = [status];

    if (status === 'in_progress' && !currentWO.actual_start_date) {
      updateQuery += `, actual_start_date = NOW()`;
    }

    queryParams.push(id, gate.businessId);
    updateQuery += ` WHERE frontend_id = $${queryParams.length - 1} AND business_id = $${queryParams.length} RETURNING *`;

    const updated = await db.query(updateQuery, queryParams);

    return NextResponse.json({
      success: true,
      workOrder: updated.rows[0]
    });
  } catch (err: any) {
    console.error('Error updating work order status:', err);
    return NextResponse.json({ error: err.message || 'Failed to transition status' }, { status: 400 });
  }
}
