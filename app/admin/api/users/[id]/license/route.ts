import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db.server';
import { requireAdminAuth } from '../../../../../../lib/auth/adminAuth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { license_type, duration_days } = await req.json(); // 'FREE', 'PRO', 'LIFETIME'

  try {
    const targetUser = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetUser.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (auth.admin.adminRole !== 'SUPER_ADMIN') {
      if (targetUser.rows[0].role === 'SUPER_ADMIN' || targetUser.rows[0].role === 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Insufficient privileges to modify this user.' }, { status: 403 });
      }
    }

    let expiry: Date | null = null;
    if (license_type === 'PRO' && duration_days) {
      const date = new Date();
      date.setDate(date.getDate() + parseInt(duration_days));
      expiry = date;
    }

    const updateRes = await db.query('UPDATE users SET license_type = $1, license_expiry = $2 WHERE id = $3 RETURNING *', [license_type, expiry, id]);

    // Log action
    await db.query(
      `
      INSERT INTO admin_logs (admin_id, target_user_id, action, details)
      VALUES ($1, $2, $3, $4)
    `,
      [auth.admin.adminId, id, 'UPDATE_LICENSE', `License changed to ${license_type}`]
    );

    return NextResponse.json({ success: true, user: updateRes.rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error updating user license' }, { status: 500 });
  }
}
