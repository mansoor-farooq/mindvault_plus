import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';

// auth.user.id is already resolved to the organization owner's id for both owners and
// members (see lib/auth/jwtAuth.ts) - so this single query works for either caller.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // The caller's OWN row (not the org-resolved id) determines whether they're the
    // owner - a member must see isOwner: false even though auth.user.id resolves to
    // the owner's id for data-ownership purposes elsewhere.
    const callerRow = await db.query('SELECT organization_id, org_role FROM users WHERE id = $1', [auth.user.actualUserId]);
    const organizationId = callerRow.rows[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ isOrganization: false, isOwner: false, members: [] });
    }

    const members = await db.query(
      'SELECT id, full_name, email, org_role, created_at FROM users WHERE organization_id = $1 ORDER BY org_role DESC, created_at ASC',
      [organizationId]
    );

    return NextResponse.json({
      isOrganization: true,
      isOwner: callerRow.rows[0]?.org_role === 'OWNER',
      members: members.rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
