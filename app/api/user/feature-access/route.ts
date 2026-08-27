import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';
import { getUserFeatureAccess } from '../../../../lib/services/featureAccessService';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const access = await getUserFeatureAccess(auth.user.id);
    return NextResponse.json({ access });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
