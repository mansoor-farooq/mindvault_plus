import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAdminAuth } from '../../../../lib/auth/adminAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await db.query(
      'SELECT id, full_name, email, role, account_status, license_type, license_expiry, business_type, account_type, organization_id, org_role, created_at FROM users ORDER BY created_at DESC'
    );
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error loading users' }, { status: 500 });
  }
}
