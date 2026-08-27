import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db.server';
import { requireAdminAuth } from '../../../../../../lib/auth/adminAuth';
import { getUserFeatureAccess, setUserFeatureAccess } from '../../../../../../lib/services/featureAccessService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const access = await getUserFeatureAccess(parseInt(id, 10));
    return NextResponse.json({ access });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error loading feature access' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { featureKey, isEnabled } = await req.json();

  if (typeof featureKey !== 'string' || typeof isEnabled !== 'boolean') {
    return NextResponse.json({ error: 'featureKey (string) and isEnabled (boolean) are required' }, { status: 400 });
  }

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

    await setUserFeatureAccess(parseInt(id, 10), featureKey, isEnabled);

    await db.query(
      `
      INSERT INTO admin_logs (admin_id, target_user_id, action, details)
      VALUES ($1, $2, $3, $4)
    `,
      [auth.admin.adminId, id, 'FEATURE_ACCESS_CHANGE', `Feature "${featureKey}" set to ${isEnabled ? 'enabled' : 'disabled'}`]
    );

    const access = await getUserFeatureAccess(parseInt(id, 10));
    return NextResponse.json({ success: true, access });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error updating feature access' }, { status: 500 });
  }
}
