import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db.server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const result = await db.query(
      `SELECT 
         l.frontend_id as "syncId",
         l.date,
         l.status,
         l.quantity,
         l.marked_by as "markedBy",
         l.source,
         l.confirmed_at as "confirmedAt",
         c.name as "customerName",
         st.name as "serviceName",
         st.unit as "serviceUnit",
         u.organization_name as "businessName",
         u.full_name as "ownerName"
       FROM delivery_logs l
       JOIN service_subscriptions sub ON sub.frontend_id = l.subscription_id
       JOIN khata_customers c ON c.frontend_id = sub.customer_id
       JOIN service_types st ON st.frontend_id = sub.service_type_id
       JOIN users u ON u.id = l.user_id
       WHERE l.verification_token = $1 AND l.is_deleted = false`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Delivery record not found or link has expired' }, { status: 404 });
    }

    return NextResponse.json({ delivery: result.rows[0] });
  } catch (error) {
    console.error('Error fetching confirmation record:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const body = await req.json();
    const { status } = body; // 'received' | 'not_received'

    if (!['received', 'not_received'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateResult = await db.query(
      `UPDATE delivery_logs
       SET status = $1,
           marked_by = 'customer',
           marked_by_user_id = NULL,
           source = 'whatsapp_link',
           confirmed_at = NOW(),
           updated_at = NOW()
       WHERE verification_token = $2 AND is_deleted = false
       RETURNING frontend_id as "syncId", date, status, marked_by as "markedBy", source, confirmed_at as "confirmedAt"`,
      [status, token]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Delivery record not found or link has expired' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      delivery: updateResult.rows[0],
      message: status === 'received' 
        ? 'Shukriya! Aap ki tasdeeq (receipt) darj kar li gayi hai.' 
        : 'Aap ka aitraz (not received) record kar liya gaya hai. Dukan daar se rabta kiya jayega.'
    });
  } catch (error) {
    console.error('Error saving customer confirmation:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
