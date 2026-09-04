import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';

// GET /api/factory/work-centers/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const res = await db.query(
      `SELECT * FROM work_centers WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
      [id, gate.businessId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Work center not found' }, { status: 404 });
    }

    return NextResponse.json({ workCenter: res.rows[0] });
  } catch (err: any) {
    console.error('Error fetching work center:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch work center' }, { status: 500 });
  }
}

// PUT /api/factory/work-centers/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const body = await req.json();

    const res = await db.query(
      `UPDATE work_centers SET
         name = COALESCE($1, name),
         type = COALESCE($2, type),
         capacity_per_hour = COALESCE($3, capacity_per_hour),
         shift_hours_per_day = COALESCE($4, shift_hours_per_day),
         hourly_cost_rate = COALESCE($5, hourly_cost_rate),
         status = COALESCE($6, status),
         notes = COALESCE($7, notes),
         updated_at = NOW()
       WHERE frontend_id = $8 AND business_id = $9 AND is_deleted = false
       RETURNING *`,
      [
        body.name?.trim() || null,
        body.type || null,
        body.capacityPerHour !== undefined ? Number(body.capacityPerHour) : null,
        body.shiftHoursPerDay !== undefined ? Number(body.shiftHoursPerDay) : null,
        body.hourlyCostRate !== undefined ? Number(body.hourlyCostRate) : null,
        body.status || null,
        body.notes !== undefined ? body.notes : null,
        id,
        gate.businessId
      ]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Work center not found' }, { status: 404 });
    }

    return NextResponse.json({ workCenter: res.rows[0] });
  } catch (err: any) {
    console.error('Error updating work center:', err);
    return NextResponse.json({ error: err.message || 'Failed to update work center' }, { status: 400 });
  }
}

// DELETE /api/factory/work-centers/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const res = await db.query(
      `UPDATE work_centers SET
         is_deleted = true,
         deleted_at = NOW(),
         updated_at = NOW()
       WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false
       RETURNING frontend_id`,
      [id, gate.businessId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Work center not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('Error deleting work center:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete work center' }, { status: 500 });
  }
}
