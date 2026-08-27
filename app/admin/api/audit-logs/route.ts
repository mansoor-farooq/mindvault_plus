import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAdminAuth } from '../../../../lib/auth/adminAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '', 10) || 50, 200);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '', 10) || 0;

    const logs = await db.query(
      `
      SELECT al.id, al.action, al.details, al.created_at,
             admin.full_name as admin_name, admin.email as admin_email,
             target.full_name as target_name, target.email as target_email
      FROM admin_logs al
      LEFT JOIN users admin ON al.admin_id = admin.id
      LEFT JOIN users target ON al.target_user_id = target.id
      ORDER BY al.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    const total = await db.query('SELECT COUNT(*) FROM admin_logs');

    return NextResponse.json({ logs: logs.rows, total: parseInt(total.rows[0].count, 10) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error loading audit logs' }, { status: 500 });
  }
}
