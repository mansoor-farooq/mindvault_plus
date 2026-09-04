import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db.server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';

export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'view');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const month = searchParams.get('month'); // YYYY-MM
    const subscriptionId = searchParams.get('subscriptionId');

    let query = `
      SELECT 
        l.frontend_id as "syncId",
        l.subscription_id as "subscriptionId",
        l.date,
        l.status,
        l.quantity,
        l.marked_by as "markedBy",
        l.marked_by_user_id as "markedByUserId",
        l.source,
        l.verification_token as "verificationToken",
        l.confirmed_at as "confirmedAt",
        l.created_at as "createdAt",
        l.updated_at as "updatedAt",
        sub.customer_id as "customerId",
        sub.agreed_rate as "agreedRate",
        c.name as "customerName",
        c.phone as "customerPhone",
        st.name as "serviceName",
        st.unit as "serviceUnit"
      FROM delivery_logs l
      JOIN service_subscriptions sub ON sub.frontend_id = l.subscription_id
      JOIN service_types st ON st.frontend_id = sub.service_type_id
      JOIN khata_customers c ON c.frontend_id = sub.customer_id
      WHERE l.user_id = $1 AND l.is_deleted = false
    `;
    const params: (string | number)[] = [gate.businessId];

    if (date) {
      params.push(date);
      query += ` AND l.date = $${params.length}`;
    } else if (month) {
      params.push(`${month}%`);
      query += ` AND l.date LIKE $${params.length}`;
    }

    if (subscriptionId) {
      params.push(subscriptionId);
      query += ` AND l.subscription_id = $${params.length}`;
    }

    query += ` ORDER BY l.date DESC, l.created_at DESC`;

    const result = await db.query(query, params);
    return NextResponse.json({ logs: result.rows });
  } catch (error) {
    console.error('Error fetching delivery logs:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'view');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await req.json();
    const {
      syncId,
      subscriptionId,
      date,
      status = 'received',
      quantity,
      markedBy,
      source = 'app',
      companyCode
    } = body;

    if (!subscriptionId || !date) {
      return NextResponse.json({ error: 'subscriptionId and date are required' }, { status: 400 });
    }

    // Verify subscription ownership
    const subCheck = await db.query(
      `SELECT sub.frontend_id, sub.customer_id, sub.agreed_rate, sub.default_quantity,
              c.name as "customerName", c.phone as "customerPhone", st.name as "serviceName", st.unit as "serviceUnit"
       FROM service_subscriptions sub
       JOIN khata_customers c ON c.frontend_id = sub.customer_id
       JOIN service_types st ON st.frontend_id = sub.service_type_id
       WHERE sub.frontend_id = $1 AND sub.user_id = $2 AND sub.is_deleted = false`,
      [subscriptionId, gate.businessId]
    );

    if (subCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const sub = subCheck.rows[0];

    // Determine markedBy based on caller role if not explicitly provided
    let effectiveMarkedBy: 'owner' | 'staff' | 'customer' = markedBy || 'owner';
    if (!markedBy) {
      if (gate.actualUserId && gate.actualUserId !== gate.businessId) {
        effectiveMarkedBy = 'staff';
      } else {
        effectiveMarkedBy = 'owner';
      }
    }

    const frontendId = syncId || crypto.randomUUID();
    const verificationToken = crypto.randomUUID();
    const markedByUserId = String(gate.actualUserId || gate.businessId);
    const finalQuantity = quantity !== undefined ? Number(quantity) : (sub.default_quantity || 1.0);

    const upsertResult = await db.query(
      `INSERT INTO delivery_logs (
         frontend_id, user_id, company_code, subscription_id, date, status,
         quantity, marked_by, marked_by_user_id, source, verification_token,
         created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), false)
       ON CONFLICT (subscription_id, date) DO UPDATE SET
         status = EXCLUDED.status,
         quantity = EXCLUDED.quantity,
         marked_by = EXCLUDED.marked_by,
         marked_by_user_id = EXCLUDED.marked_by_user_id,
         source = EXCLUDED.source,
         updated_at = NOW(),
         is_deleted = false,
         deleted_at = NULL
       RETURNING frontend_id as "syncId", subscription_id as "subscriptionId", date, status, 
                 quantity, marked_by as "markedBy", source, verification_token as "verificationToken"`,
      [
        frontendId,
        gate.businessId,
        companyCode || null,
        subscriptionId,
        date,
        status,
        finalQuantity,
        effectiveMarkedBy,
        markedByUserId,
        source,
        verificationToken
      ]
    );

    const savedLog = upsertResult.rows[0];

    // Build customer WhatsApp confirmation URL
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const confirmUrl = `${proto}://${host}/confirm-service/${savedLog.verificationToken}`;
    
    // Generate pre-filled WhatsApp message in Roman Urdu
    const whatsAppMessage = `Assalam-o-Alaikum ${sub.customerName}, aaj (${date}) ki ${sub.serviceName} (${finalQuantity} ${sub.serviceUnit || ''}) delivery register ho gayi hai.\n\nTasdeeq (Confirmation) ke liye neeche diye gaye link par click karein:\n${confirmUrl}`;

    return NextResponse.json({
      success: true,
      log: savedLog,
      confirmUrl,
      whatsAppMessage,
      customerPhone: sub.customerPhone
    });
  } catch (error) {
    console.error('Error saving delivery log:', error);
    return NextResponse.json({ error: 'Failed to save delivery log' }, { status: 500 });
  }
}
