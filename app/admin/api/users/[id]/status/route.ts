import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db.server';
import { requireAdminAuth } from '../../../../../../lib/auth/adminAuth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { status } = await req.json(); // 'ACTIVE', 'BANNED', 'SUSPENDED'

  try {
    const targetUser = await db.query('SELECT role, account_status FROM users WHERE id = $1', [id]);
    if (targetUser.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const oldStatus = targetUser.rows[0].account_status || 'ACTIVE';

    if (auth.admin.adminRole !== 'SUPER_ADMIN') {
      if (targetUser.rows[0].role === 'SUPER_ADMIN' || targetUser.rows[0].role === 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Insufficient privileges to modify this user.' }, { status: 403 });
      }
    }

    const updateRes = await db.query('UPDATE users SET account_status = $1 WHERE id = $2 RETURNING *', [status, id]);

    const action = status === 'BANNED' ? 'USER_BLOCK' : status === 'ACTIVE' ? 'USER_UNBLOCK' : 'USER_STATUS_CHANGE';

    // Log action to admin_logs table with before and after status
    await db.query(
      `
      INSERT INTO admin_logs (admin_id, target_user_id, action, details)
      VALUES ($1, $2, $3, $4)
    `,
      [auth.admin.adminId, id, action, `Status changed from ${oldStatus} to ${status}`]
    );

    return NextResponse.json({ success: true, user: updateRes.rows[0], oldStatus, newStatus: status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error updating user status' }, { status: 500 });
  }
}
