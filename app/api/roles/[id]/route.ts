import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { updateCustomRole, deleteCustomRole } from '@/lib/services/permissionService';

// PUT /api/roles/[id] - Update custom role permissions or metadata
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireModuleAccess(req, 'team_management', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const result = await updateCustomRole(gate.businessId, gate.actualUserId, id, body);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating role:', err);
    return NextResponse.json({ error: err.message || 'Failed to update role' }, { status: 400 });
  }
}

// DELETE /api/roles/[id] - Soft delete custom role
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireModuleAccess(req, 'team_management', 'full');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const result = await deleteCustomRole(gate.businessId, gate.actualUserId, id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error deleting role:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete role' }, { status: 400 });
  }
}
