import { NextRequest, NextResponse } from 'next/server';
import * as driveService from '../../../../lib/services/googleDriveService';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await db.query(
    'SELECT google_drive_connected_at, google_drive_last_backup_at FROM users WHERE id = $1',
    [auth.user.id]
  );
  const row = result.rows[0];
  return NextResponse.json({
    connected: !!row?.google_drive_connected_at,
    connectedAt: row?.google_drive_connected_at,
    lastBackupAt: row?.google_drive_last_backup_at,
    configured: driveService.isConfigured(),
  });
}
