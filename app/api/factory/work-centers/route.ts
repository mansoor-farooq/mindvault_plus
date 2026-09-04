import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { getBusinessFactoryTier } from '@/lib/services/factoryService';
import crypto from 'crypto';

// GET /api/factory/work-centers - List all work centers
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const res = await db.query(
      `SELECT wc.*,
              (SELECT COUNT(*) FROM work_order_operations woo 
               WHERE woo.work_center_id = wc.frontend_id 
                 AND woo.status = 'in_progress' 
                 AND woo.is_deleted = false) as active_operations_count
       FROM work_centers wc
       WHERE wc.business_id = $1 AND wc.is_deleted = false
       ORDER BY wc.name ASC`,
      [gate.businessId]
    );

    return NextResponse.json({ workCenters: res.rows });
  } catch (err: any) {
    console.error('Error fetching work centers:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch work centers' }, { status: 500 });
  }
}

// POST /api/factory/work-centers - Create a new work center with tier enforcement
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const caps = await getBusinessFactoryTier(gate.businessId);

    // Enforce tier limit on work centers
    const countRes = await db.query(
      `SELECT COUNT(*) as count FROM work_centers WHERE business_id = $1 AND is_deleted = false`,
      [gate.businessId]
    );
    const currentCount = Number(countRes.rows[0]?.count || 0);

    if (currentCount >= caps.maxWorkCenters) {
      return NextResponse.json(
        {
          error: `Work center limit reached (${caps.maxWorkCenters} max for your current plan). Upgrade to ULTRA or LIFETIME for unlimited work centers.`
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, type, capacityPerHour, shiftHoursPerDay, hourlyCostRate, notes, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Work center name is required' }, { status: 400 });
    }
    if (!capacityPerHour || Number(capacityPerHour) <= 0) {
      return NextResponse.json({ error: 'capacityPerHour must be greater than 0' }, { status: 400 });
    }

    const syncId = crypto.randomUUID();
    const result = await db.query(
      `INSERT INTO work_centers (
         frontend_id, business_id, name, type, capacity_per_hour,
         shift_hours_per_day, hourly_cost_rate, status, notes,
         created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), false)
       RETURNING *`,
      [
        syncId,
        gate.businessId,
        name.trim(),
        type || 'MACHINE',
        Number(capacityPerHour),
        Number(shiftHoursPerDay) || 8,
        Number(hourlyCostRate) || 0,
        status || 'ACTIVE',
        notes || null
      ]
    );

    return NextResponse.json({ workCenter: result.rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating work center:', err);
    return NextResponse.json({ error: err.message || 'Failed to create work center' }, { status: 400 });
  }
}
