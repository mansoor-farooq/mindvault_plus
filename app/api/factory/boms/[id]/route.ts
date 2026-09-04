import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { updateBOM } from '@/lib/services/factoryService';

// GET /api/factory/boms/[id] - Get single BOM with line items
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const bomRes = await db.query(
      `SELECT b.*, p.name as product_name, p.sku as product_sku, p.selling_price as product_price
       FROM bill_of_materials b
       JOIN products p ON p.frontend_id = b.finished_product_id
       WHERE b.frontend_id = $1 AND b.business_id = $2 AND b.is_deleted = false`,
      [id, gate.businessId]
    );

    if (bomRes.rows.length === 0) {
      return NextResponse.json({ error: 'BOM not found' }, { status: 404 });
    }

    const bom = bomRes.rows[0];

    const linesRes = await db.query(
      `SELECT bli.*, p.name as component_name, p.sku as component_sku, p.cost_price as component_cost_price
       FROM bom_line_items bli
       JOIN products p ON p.frontend_id = bli.component_product_id
       WHERE bli.bom_id = $1 AND bli.is_deleted = false
       ORDER BY bli.created_at ASC`,
      [id]
    );

    return NextResponse.json({
      bom: {
        ...bom,
        line_items: linesRes.rows
      }
    });
  } catch (err: any) {
    console.error('Error fetching BOM details:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch BOM' }, { status: 500 });
  }
}

// PUT /api/factory/boms/[id] - Update BOM (bumps version)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const body = await req.json();

    const result = await updateBOM({
      businessId: gate.businessId,
      actorUserId: gate.actualUserId,
      bomId: id,
      status: body.status,
      laborTimeEstimateMinutes: body.laborTimeEstimateMinutes !== undefined ? Number(body.laborTimeEstimateMinutes) : undefined,
      overheadRatePerUnit: body.overheadRatePerUnit !== undefined ? Number(body.overheadRatePerUnit) : undefined,
      notes: body.notes,
      lineItems: body.lineItems
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating BOM:', err);
    const status = err.message?.includes('CIRCULAR_BOM_DEPENDENCY') ? 422 : 400;
    return NextResponse.json({ error: err.message || 'Failed to update BOM' }, { status });
  }
}

// DELETE /api/factory/boms/[id] - Soft delete BOM
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const res = await db.query(
      `UPDATE bill_of_materials SET
         is_deleted = true,
         status = 'deprecated',
         deleted_at = NOW(),
         updated_at = NOW()
       WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false
       RETURNING frontend_id`,
      [id, gate.businessId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'BOM not found' }, { status: 404 });
    }

    // Soft delete associated line items
    await db.query(
      `UPDATE bom_line_items SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE bom_id = $1`,
      [id]
    );

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('Error deleting BOM:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete BOM' }, { status: 500 });
  }
}
