import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import crypto from 'crypto';

// GET /api/factory/defects - List quality defect logs
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const workOrderId = url.searchParams.get('workOrderId');

    let query = `
      SELECT qdl.*, wo.order_number, u.name as logged_by_name
      FROM quality_defect_logs qdl
      JOIN work_orders wo ON wo.frontend_id = qdl.work_order_id
      LEFT JOIN users u ON u.id = qdl.logged_by_user_id
      WHERE qdl.business_id = $1 AND qdl.is_deleted = false
    `;
    const params: any[] = [gate.businessId];

    if (workOrderId) {
      params.push(workOrderId);
      query += ` AND qdl.work_order_id = $${params.length}`;
    }

    query += ` ORDER BY qdl.timestamp DESC LIMIT 100`;

    const res = await db.query(query, params);
    return NextResponse.json({ defectLogs: res.rows });
  } catch (err: any) {
    console.error('Error fetching quality defect logs:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch defect logs' }, { status: 500 });
  }
}

// POST /api/factory/defects - Log quality defect (MES Quality Compliance)
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const { workOrderId, workOrderOperationId, defectType, quantityDefective, notes } = body;

    if (!workOrderId) {
      return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
    }
    const qty = Number(quantityDefective);
    if (!qty || qty <= 0) {
      return NextResponse.json({ error: 'quantityDefective must be greater than 0' }, { status: 400 });
    }

    const validTypes = ['dimensional', 'surface', 'material', 'assembly', 'packaging', 'other'];
    const validType = validTypes.includes(defectType) ? defectType : 'other';

    const syncId = crypto.randomUUID();
    const res = await db.query(
      `INSERT INTO quality_defect_logs (
         frontend_id, business_id, work_order_id, work_order_operation_id,
         defect_type, quantity_defective, notes, logged_by_user_id,
         timestamp, created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW(), false)
       RETURNING *`,
      [
        syncId,
        gate.businessId,
        workOrderId,
        workOrderOperationId || null,
        validType,
        qty,
        notes || null,
        gate.actualUserId
      ]
    );

    return NextResponse.json({ defectLog: res.rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Error recording defect:', err);
    return NextResponse.json({ error: err.message || 'Failed to record defect' }, { status: 400 });
  }
}
