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
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7); // YYYY-MM

    // 1. Fetch active subscriptions for this user
    const subsRes = await db.query(
      `SELECT 
         sub.frontend_id as "subscriptionId",
         sub.customer_id as "customerId",
         sub.service_type_id as "serviceTypeId",
         sub.agreed_rate as "agreedRate",
         sub.default_quantity as "defaultQuantity",
         sub.frequency,
         sub.start_date as "startDate",
         c.name as "customerName",
         c.phone as "customerPhone",
         st.name as "serviceName",
         st.unit as "serviceUnit"
       FROM service_subscriptions sub
       JOIN khata_customers c ON c.frontend_id = sub.customer_id
       JOIN service_types st ON st.frontend_id = sub.service_type_id
       WHERE sub.user_id = $1 AND sub.is_deleted = false
       ORDER BY c.name ASC`,
      [gate.businessId]
    );

    const subscriptions = subsRes.rows;

    // 2. Fetch all logs for this user in the specified month
    const logsRes = await db.query(
      `SELECT subscription_id as "subscriptionId", date, status, quantity, marked_by as "markedBy", source
       FROM delivery_logs
       WHERE user_id = $1 AND date LIKE $2 AND is_deleted = false
       ORDER BY date ASC`,
      [gate.businessId, `${month}%`]
    );

    const logs = logsRes.rows;

    // Group logs by subscriptionId
    const logsBySub = new Map<string, typeof logs>();
    for (const log of logs) {
      if (!logsBySub.has(log.subscriptionId)) {
        logsBySub.set(log.subscriptionId, []);
      }
      logsBySub.get(log.subscriptionId)!.push(log);
    }

    // 3. Compute live billing for each subscription
    const summaries = subscriptions.map((sub) => {
      const subLogs = logsBySub.get(sub.subscriptionId) || [];
      
      let receivedDays = 0;
      let notReceivedDays = 0;
      let skippedDays = 0;
      let totalDeliveredUnits = 0;

      for (const log of subLogs) {
        if (log.status === 'received') {
          receivedDays++;
          const qty = log.quantity !== null && log.quantity !== undefined ? Number(log.quantity) : 1;
          totalDeliveredUnits += qty;
        } else if (log.status === 'not_received') {
          notReceivedDays++;
        } else if (log.status === 'skipped') {
          skippedDays++;
        }
      }

      const totalBill = Math.round(totalDeliveredUnits * Number(sub.agreedRate));

      return {
        ...sub,
        month,
        receivedDays,
        notReceivedDays,
        skippedDays,
        totalDeliveredUnits,
        totalBill,
        logs: subLogs
      };
    });

    return NextResponse.json({
      month,
      summaries
    });
  } catch (error) {
    console.error('Error calculating service billing:', error);
    return NextResponse.json({ error: 'Failed to calculate billing' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'service_tracker', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await req.json();
    const { subscriptionId, month } = body;

    if (!subscriptionId || !month) {
      return NextResponse.json({ error: 'subscriptionId and month are required' }, { status: 400 });
    }

    // 1. Fetch subscription details
    const subRes = await db.query(
      `SELECT sub.frontend_id, sub.customer_id, sub.agreed_rate,
              c.name as "customerName", st.name as "serviceName", st.unit as "serviceUnit"
       FROM service_subscriptions sub
       JOIN khata_customers c ON c.frontend_id = sub.customer_id
       JOIN service_types st ON st.frontend_id = sub.service_type_id
       WHERE sub.frontend_id = $1 AND sub.user_id = $2 AND sub.is_deleted = false`,
      [subscriptionId, gate.businessId]
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const sub = subRes.rows[0];

    // 2. Compute bill dynamically
    const logsRes = await db.query(
      `SELECT quantity, status
       FROM delivery_logs
       WHERE subscription_id = $1 AND user_id = $2 AND date LIKE $3 AND is_deleted = false`,
      [subscriptionId, gate.businessId, `${month}%`]
    );

    let receivedCount = 0;
    let totalDeliveredUnits = 0;
    for (const log of logsRes.rows) {
      if (log.status === 'received') {
        receivedCount++;
        const qty = log.quantity !== null && log.quantity !== undefined ? Number(log.quantity) : 1;
        totalDeliveredUnits += qty;
      }
    }

    const totalAmount = Math.round(totalDeliveredUnits * Number(sub.agreed_rate));

    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'No delivered services to bill for this month' }, { status: 400 });
    }

    // 3. Post to khata_transactions as CREDIT entry
    const txnFrontendId = crypto.randomUUID();
    const note = `Rozana Service: ${sub.serviceName} (${month} Bill) - ${receivedCount} din delivered`;
    const todayDate = new Date().toISOString().slice(0, 10);

    const txnResult = await db.query(
      `INSERT INTO khata_transactions (
         frontend_id, user_id, customer_id, type, amount, note, date,
         created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, 'CREDIT', $4, $5, $6, NOW(), NOW(), false)
       RETURNING frontend_id as "syncId", customer_id as "customerId", type, amount, note, date`,
      [
        txnFrontendId,
        gate.businessId,
        sub.customer_id,
        totalAmount,
        note,
        todayDate
      ]
    );

    return NextResponse.json({
      success: true,
      transaction: txnResult.rows[0],
      totalAmount,
      receivedCount,
      customerName: sub.customerName
    });
  } catch (error) {
    console.error('Error posting service bill to khata:', error);
    return NextResponse.json({ error: 'Failed to post bill to khata' }, { status: 500 });
  }
}
