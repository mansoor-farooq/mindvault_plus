import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAdminAuth } from '../../../../lib/auth/adminAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [users, notes, ledger, khata, license, statuses, signups] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM notes WHERE is_deleted = false'),
      db.query('SELECT COUNT(*) FROM ledger_entries WHERE is_deleted = false'),
      db.query('SELECT COUNT(*) FROM khata_customers WHERE is_deleted = false'),
      db.query('SELECT license_type, COUNT(*) FROM users GROUP BY license_type'),
      db.query('SELECT account_status, COUNT(*) FROM users GROUP BY account_status'),
      db.query(`
        SELECT to_char(d, 'YYYY-MM-DD') as date, COUNT(u.id) as count
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d
        LEFT JOIN users u ON u.created_at::date = d::date
        GROUP BY d ORDER BY d
      `),
    ]);

    const licenseBreakdown: Record<string, number> = { FREE: 0, PRO: 0, LIFETIME: 0 };
    license.rows.forEach((r: { license_type: string; count: string }) => {
      licenseBreakdown[r.license_type] = parseInt(r.count, 10);
    });

    const statusBreakdown: Record<string, number> = { ACTIVE: 0, BANNED: 0, SUSPENDED: 0 };
    statuses.rows.forEach((r: { account_status: string | null; count: string }) => {
      statusBreakdown[r.account_status || 'ACTIVE'] = parseInt(r.count, 10);
    });

    return NextResponse.json({
      totalUsers: parseInt(users.rows[0].count, 10),
      totalNotes: parseInt(notes.rows[0].count, 10),
      totalLedgerEntries: parseInt(ledger.rows[0].count, 10),
      totalKhataCustomers: parseInt(khata.rows[0].count, 10),
      licenseBreakdown,
      statusBreakdown,
      signupsLast7Days: signups.rows.map((r: { date: string; count: string }) => ({ date: r.date, count: parseInt(r.count, 10) })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error loading dashboard stats' }, { status: 500 });
  }
}
