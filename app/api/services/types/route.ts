import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db.server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';

export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'view');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const result = await db.query(
      `SELECT frontend_id as "syncId", name, unit, default_rate as "defaultRate", 
              company_code as "companyCode", created_at as "createdAt", updated_at as "updatedAt"
       FROM service_types 
       WHERE user_id = $1 AND is_deleted = false
       ORDER BY created_at ASC`,
      [gate.businessId]
    );

    return NextResponse.json({ serviceTypes: result.rows });
  } catch (error) {
    console.error('Error fetching service types:', error);
    return NextResponse.json({ error: 'Failed to fetch service types' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await req.json();
    const { syncId, name, unit = 'fixed', defaultRate = 0, companyCode } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const frontendId = syncId || crypto.randomUUID();

    const insertResult = await db.query(
      `INSERT INTO service_types (frontend_id, user_id, company_code, name, unit, default_rate, created_at, updated_at, is_deleted)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), false)
       ON CONFLICT (frontend_id) DO UPDATE SET
         name = EXCLUDED.name,
         unit = EXCLUDED.unit,
         default_rate = EXCLUDED.default_rate,
         updated_at = NOW(),
         is_deleted = false,
         deleted_at = NULL
       RETURNING frontend_id as "syncId", name, unit, default_rate as "defaultRate", company_code as "companyCode"`,
      [frontendId, gate.businessId, companyCode || null, name.trim(), unit, Number(defaultRate) || 0]
    );

    return NextResponse.json({ success: true, serviceType: insertResult.rows[0] });
  } catch (error) {
    console.error('Error creating service type:', error);
    return NextResponse.json({ error: 'Failed to create service type' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await req.json();
    const { syncId, name, unit, defaultRate } = body;

    if (!syncId) {
      return NextResponse.json({ error: 'syncId is required' }, { status: 400 });
    }

    const result = await db.query(
      `UPDATE service_types 
       SET name = COALESCE($1, name),
           unit = COALESCE($2, unit),
           default_rate = COALESCE($3, default_rate),
           updated_at = NOW()
       WHERE frontend_id = $4 AND user_id = $5 AND is_deleted = false
       RETURNING frontend_id as "syncId", name, unit, default_rate as "defaultRate"`,
      [name?.trim() || null, unit || null, defaultRate !== undefined ? Number(defaultRate) : null, syncId, gate.businessId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, serviceType: result.rows[0] });
  } catch (error) {
    console.error('Error updating service type:', error);
    return NextResponse.json({ error: 'Failed to update service type' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const syncId = searchParams.get('syncId');

    if (!syncId) {
      return NextResponse.json({ error: 'syncId is required' }, { status: 400 });
    }

    await db.query(
      `UPDATE service_types 
       SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
       WHERE frontend_id = $1 AND user_id = $2`,
      [syncId, gate.user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service type:', error);
    return NextResponse.json({ error: 'Failed to delete service type' }, { status: 500 });
  }
}
