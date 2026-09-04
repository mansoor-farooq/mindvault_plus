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
      `SELECT 
         sub.frontend_id as "syncId",
         sub.customer_id as "customerId",
         sub.service_type_id as "serviceTypeId",
         sub.start_date as "startDate",
         sub.frequency,
         sub.custom_days as "customDays",
         sub.agreed_rate as "agreedRate",
         sub.default_quantity as "defaultQuantity",
         sub.status,
         sub.company_code as "companyCode",
         sub.created_at as "createdAt",
         sub.updated_at as "updatedAt",
         c.name as "customerName",
         c.phone as "customerPhone",
         st.name as "serviceTypeName",
         st.unit as "serviceTypeUnit"
       FROM service_subscriptions sub
       LEFT JOIN khata_customers c ON c.frontend_id = sub.customer_id AND c.user_id = sub.user_id
       LEFT JOIN service_types st ON st.frontend_id = sub.service_type_id AND st.user_id = st.user_id
       WHERE sub.user_id = $1 AND sub.is_deleted = false
       ORDER BY sub.created_at DESC`,
      [gate.businessId]
    );

    return NextResponse.json({ subscriptions: result.rows });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await req.json();
    const {
      syncId,
      customerId,
      serviceTypeId,
      startDate,
      frequency = 'daily',
      customDays = null,
      agreedRate,
      defaultQuantity = 1.0,
      companyCode,
      status = 'active'
    } = body;

    if (!customerId || !serviceTypeId || !startDate || agreedRate === undefined) {
      return NextResponse.json({ error: 'customerId, serviceTypeId, startDate, and agreedRate are required' }, { status: 400 });
    }

    // Verify ownership of customer & service type
    const customerCheck = await db.query('SELECT 1 FROM khata_customers WHERE frontend_id = $1 AND user_id = $2', [customerId, gate.businessId]);
    if (customerCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid customer' }, { status: 400 });
    }

    const serviceCheck = await db.query('SELECT 1 FROM service_types WHERE frontend_id = $1 AND user_id = $2', [serviceTypeId, gate.businessId]);
    if (serviceCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid service type' }, { status: 400 });
    }

    const frontendId = syncId || crypto.randomUUID();

    const insertResult = await db.query(
      `INSERT INTO service_subscriptions (
         frontend_id, user_id, company_code, customer_id, service_type_id, 
         start_date, frequency, custom_days, agreed_rate, default_quantity, status,
         created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), false)
       ON CONFLICT (frontend_id) DO UPDATE SET
         customer_id = EXCLUDED.customer_id,
         service_type_id = EXCLUDED.service_type_id,
         start_date = EXCLUDED.start_date,
         frequency = EXCLUDED.frequency,
         custom_days = EXCLUDED.custom_days,
         agreed_rate = EXCLUDED.agreed_rate,
         default_quantity = EXCLUDED.default_quantity,
         status = EXCLUDED.status,
         updated_at = NOW(),
         is_deleted = false,
         deleted_at = NULL
       RETURNING frontend_id as "syncId", customer_id as "customerId", service_type_id as "serviceTypeId", 
                 agreed_rate as "agreedRate", status`,
      [
        frontendId,
        gate.businessId,
        companyCode || null,
        customerId,
        serviceTypeId,
        startDate,
        frequency,
        customDays ? JSON.stringify(customDays) : null,
        Number(agreedRate) || 0,
        Number(defaultQuantity) || 1.0,
        status
      ]
    );

    return NextResponse.json({ success: true, subscription: insertResult.rows[0] });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await req.json();
    const { syncId, agreedRate, defaultQuantity, frequency, customDays, status } = body;

    if (!syncId) {
      return NextResponse.json({ error: 'syncId is required' }, { status: 400 });
    }

    const result = await db.query(
      `UPDATE service_subscriptions
       SET agreed_rate = COALESCE($1, agreed_rate),
           default_quantity = COALESCE($2, default_quantity),
           frequency = COALESCE($3, frequency),
           custom_days = COALESCE($4, custom_days),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE frontend_id = $6 AND user_id = $7 AND is_deleted = false
       RETURNING frontend_id as "syncId", status, agreed_rate as "agreedRate"`,
      [
        agreedRate !== undefined ? Number(agreedRate) : null,
        defaultQuantity !== undefined ? Number(defaultQuantity) : null,
        frequency || null,
        customDays ? JSON.stringify(customDays) : null,
        status || null,
        syncId,
        gate.businessId
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, subscription: result.rows[0] });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
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
      `UPDATE service_subscriptions
       SET is_deleted = true, deleted_at = NOW(), updated_at = NOW()
       WHERE frontend_id = $1 AND user_id = $2`,
      [syncId, gate.user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
