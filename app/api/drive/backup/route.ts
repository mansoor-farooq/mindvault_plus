import { NextRequest, NextResponse } from 'next/server';
import * as driveService from '../../../../lib/services/googleDriveService';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../lib/services/featureAccessService';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'drive_backup');
  if (featureError) return featureError;

  try {
    const userId = auth.user.id;
    const userRes = await db.query('SELECT google_drive_refresh_token, full_name FROM users WHERE id = $1', [userId]);
    const refreshToken = userRes.rows[0]?.google_drive_refresh_token;
    if (!refreshToken) {
      return NextResponse.json({ error: 'DRIVE_NOT_CONNECTED' }, { status: 400 });
    }

    // Gather this user's own data only (userId from the JWT, never client input).
    const [notes, ledger, udhaar, bills, khataCustomers, khataTransactions] = await Promise.all([
      db.query('SELECT * FROM notes WHERE user_id = $1 AND is_deleted = false', [userId]),
      db.query('SELECT * FROM ledger_entries WHERE user_id = $1 AND is_deleted = false', [userId]),
      db.query('SELECT * FROM udhaar WHERE user_id = $1 AND is_deleted = false', [userId]),
      db.query('SELECT * FROM bills WHERE user_id = $1 AND is_deleted = false', [userId]),
      db.query('SELECT * FROM khata_customers WHERE user_id = $1 AND is_deleted = false', [userId]),
      db.query('SELECT * FROM khata_transactions WHERE user_id = $1 AND is_deleted = false', [userId]),
    ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      app: 'MindVault',
      notes: notes.rows,
      ledgerEntries: ledger.rows,
      udhaar: udhaar.rows,
      bills: bills.rows,
      khataCustomers: khataCustomers.rows,
      khataTransactions: khataTransactions.rows,
    };

    const accessToken = await driveService.getAccessToken(refreshToken);
    const filename = `MindVault_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    const uploaded = await driveService.uploadBackup(accessToken, filename, backupData);

    await db.query('UPDATE users SET google_drive_last_backup_at = NOW() WHERE id = $1', [userId]);

    return NextResponse.json({ success: true, fileId: uploaded.id, filename });
  } catch (error) {
    console.error('Drive backup error:', error);
    return NextResponse.json({ error: 'BACKUP_FAILED', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
