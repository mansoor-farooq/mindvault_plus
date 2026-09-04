import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import crypto from 'crypto';

// GET /api/factory/downtime - List machine downtime logs
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const workCenterId = url.searchParams.get('workCenterId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let query = `
      SELECT mdl.*, wc.name as work_center_name, u.name as logged_by_name
      FROM machine_downtime_logs mdl
      JOIN work_centers wc ON wc.frontend_id = mdl.work_center_id
      LEFT JOIN users u ON u.id = mdl.logged_by_user_id
      WHERE mdl.business_id = $1 AND mdl.is_deleted = false
    `;
    const params: any[] = [gate.businessId];

    if (workCenterId) {
      params.push(workCenterId);
      query += ` AND mdl.work_center_id = $${params.length}`;
    }
    if (startDate) {
      params.push(new Date(startDate));
      query += ` AND mdl.start_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(new Date(endDate));
      query += ` AND mdl.start_time <= $${params.length}`;
    }

    query += ` ORDER BY mdl.start_time DESC LIMIT 100`;

    const res = await db.query(query, params);
    return NextResponse.json({ downtimeLogs: res.rows });
  } catch (err: any) {
    console.error('Error fetching downtime logs:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch downtime logs' }, { status: 500 });
  }
}

// POST /api/factory/downtime - Log machine downtime (Floor MES)
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const { workCenterId, startTime, endTime, durationMinutes, reasonCode, notes } = body;

    if (!workCenterId) {
      return NextResponse.json({ error: 'workCenterId is required' }, { status: 400 });
    }

    const sTime = startTime ? new Date(startTime) : new Date();
    const eTime = endTime ? new Date(endTime) : null;
    let duration = Number(durationMinutes);

    if ((!duration || duration <= 0) && eTime) {
      duration = Math.max(1, Math.round((eTime.getTime() - sTime.getTime()) / (1000 * 60)));
    }
    if (!duration || duration <= 0) {
      duration = 1; // Minimum 1 minute
    }

    const validReasons = ['breakdown', 'maintenance', 'material_wait', 'changeover', 'power_outage', 'other'];
    const validCode = validReasons.includes(reasonCode) ? reasonCode : 'other';

    const syncId = crypto.randomUUID();
    const res = await db.query(
      `INSERT INTO machine_downtime_logs (
         frontend_id, business_id, work_center_id, start_time, end_time,
         duration_minutes, reason_code, notes, logged_by_user_id,
         created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), false)
       RETURNING *`,
      [
        syncId,
        gate.businessId,
        workCenterId,
        sTime,
        eTime,
        duration,
        validCode,
        notes || null,
        gate.actualUserId
      ]
    );

    return NextResponse.json({ downtimeLog: res.rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Error recording machine downtime:', err);
    return NextResponse.json({ error: err.message || 'Failed to record downtime' }, { status: 400 });
  }
}
