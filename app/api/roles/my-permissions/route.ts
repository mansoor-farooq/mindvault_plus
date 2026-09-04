import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/jwtAuth';
import { resolveUserPermissions } from '@/lib/services/permissionService';

// GET /api/roles/my-permissions - Get the caller's live resolved permissions matrix
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const businessId = auth.user.id as number;
  const actualUserId = (auth.user.actualUserId as number) || businessId;

  try {
    const userPerms = await resolveUserPermissions(actualUserId, businessId);
    return NextResponse.json(userPerms);
  } catch (err: any) {
    console.error('Error resolving user permissions:', err);
    return NextResponse.json({ error: err.message || 'Failed to resolve permissions' }, { status: 500 });
  }
}
