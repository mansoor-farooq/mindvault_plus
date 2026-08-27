import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const callerRow = await db.query('SELECT org_role, organization_id FROM users WHERE id = $1', [auth.user.actualUserId]);
    const caller = callerRow.rows[0];
    if (!caller?.organization_id || caller.org_role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the organization owner can remove team members' }, { status: 403 });
    }

    // Ownership check: the target must actually belong to the caller's own organization,
    // never allow removing an arbitrary user id from someone else's org.
    const target = await db.query('SELECT id, org_role FROM users WHERE id = $1 AND organization_id = $2', [userId, caller.organization_id]);
    if (target.rows.length === 0) {
      return NextResponse.json({ error: 'User not found in your organization' }, { status: 404 });
    }
    if (target.rows[0].org_role === 'OWNER') {
      return NextResponse.json({ error: 'The organization owner cannot remove themselves' }, { status: 400 });
    }

    // Removing a member turns them back into a plain isolated individual account rather
    // than deleting them - they keep logging in, just with no shared organization data.
    await db.query(`UPDATE users SET organization_id = NULL, org_role = NULL, account_type = 'INDIVIDUAL' WHERE id = $1`, [userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
