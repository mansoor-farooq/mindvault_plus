import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { listRolesForBusiness, createCustomRole } from '@/lib/services/permissionService';

// GET /api/roles - List all roles for business with permissions & member counts
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'team_management', 'view');
  if (!gate.ok) return gate.response;

  try {
    const roles = await listRolesForBusiness(gate.businessId);
    return NextResponse.json({ roles });
  } catch (err: any) {
    console.error('Error listing roles:', err);
    return NextResponse.json({ error: err.message || 'Failed to list roles' }, { status: 500 });
  }
}

// POST /api/roles - Create a new custom role with validated permissions
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'team_management', 'full');
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const result = await createCustomRole(gate.businessId, gate.actualUserId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('Error creating role:', err);
    return NextResponse.json({ error: err.message || 'Failed to create role' }, { status: 400 });
  }
}
