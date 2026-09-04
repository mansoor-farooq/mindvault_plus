import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { getPermissionAuditLogs } from '@/lib/services/permissionService';

// GET /api/roles/audit-logs - View audit trail of permission changes
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'team_management', 'view');
  if (!gate.ok) return gate.response;

  try {
    const logs = await getPermissionAuditLogs(gate.businessId);
    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error('Error fetching permission audit logs:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
