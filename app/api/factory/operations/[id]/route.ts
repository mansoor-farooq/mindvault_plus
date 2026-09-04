import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';

// PUT /api/factory/operations/[id] - Update operation status and throughput (Shop Floor MES)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, quantityCompleted, actualStartTime, actualEndTime, notes } = body;

    const opRes = await db.query(
      `SELECT * FROM work_order_operations WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
      [id, gate.businessId]
    );

    if (opRes.rows.length === 0) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    const currentOp = opRes.rows[0];

    let start = currentOp.actual_start_time;
    if (actualStartTime !== undefined) {
      start = actualStartTime ? new Date(actualStartTime) : null;
    } else if (status === 'in_progress' && !start) {
      start = new Date();
    }

    let end = currentOp.actual_end_time;
    if (actualEndTime !== undefined) {
      end = actualEndTime ? new Date(actualEndTime) : null;
    } else if (status === 'completed' && !end) {
      end = new Date();
    }

    const updatedQty = quantityCompleted !== undefined ? Number(quantityCompleted) : currentOp.quantity_completed;

    const res = await db.query(
      `UPDATE work_order_operations SET
         status = COALESCE($1, status),
         quantity_completed = $2,
         actual_start_time = $3,
         actual_end_time = $4,
         notes = COALESCE($5, notes),
         updated_at = NOW()
       WHERE frontend_id = $6 AND business_id = $7 AND is_deleted = false
       RETURNING *`,
      [
        status || null,
        updatedQty,
        start,
        end,
        notes !== undefined ? notes : null,
        id,
        gate.businessId
      ]
    );

    // If an operation was started or completed, check if work order status should be updated to in_progress
    if (status === 'in_progress') {
      await db.query(
        `UPDATE work_orders SET status = 'in_progress', actual_start_date = COALESCE(actual_start_date, NOW()), updated_at = NOW()
         WHERE frontend_id = $1 AND status = 'planned'`,
        [currentOp.work_order_id]
      );
    }

    return NextResponse.json({
      operation: res.rows[0]
    });
  } catch (err: any) {
    console.error('Error updating operation:', err);
    return NextResponse.json({ error: err.message || 'Failed to update operation' }, { status: 400 });
  }
}
