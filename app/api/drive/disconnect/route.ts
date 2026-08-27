import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await db.query(
    'UPDATE users SET google_drive_refresh_token = NULL, google_drive_connected_at = NULL WHERE id = $1',
    [auth.user.id]
  );
  return NextResponse.json({ success: true });
}
