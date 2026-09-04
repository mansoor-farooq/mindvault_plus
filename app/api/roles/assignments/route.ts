import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { listUserAssignments, assignUserRole } from '@/lib/services/permissionService';

// GET /api/roles/assignments - List all users with active role assignments
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'team_management', 'view');
  if (!gate.ok) return gate.response;

  try {
    const assignments = await listUserAssignments(gate.businessId);
    return NextResponse.json({ assignments });
  } catch (err: any) {
    console.error('Error listing assignments:', err);
    return NextResponse.json({ error: err.message || 'Failed to list assignments' }, { status: 500 });
  }
}

// POST /api/roles/assignments - Assign user to a role
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'team_management', 'full');
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const { targetUserId, roleId } = body;
    if (!targetUserId || !roleId) {
      return NextResponse.json({ error: 'targetUserId and roleId are required' }, { status: 400 });
    }

    const result = await assignUserRole(gate.businessId, gate.actualUserId, Number(targetUserId), roleId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error assigning role:', err);
    return NextResponse.json({ error: err.message || 'Failed to assign role' }, { status: 400 });
  }
}
