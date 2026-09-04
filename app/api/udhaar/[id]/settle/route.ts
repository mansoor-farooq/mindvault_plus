import { NextRequest, NextResponse } from 'next/server';
import { UdhaarModel } from '../../../../../lib/models/udhaarModel';
import { requireModuleAccess } from '../../../../../lib/auth/moduleGate';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireModuleAccess(req, 'khata', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const { id } = await params;
    const user_id = gate.user.id;

    const settled = await UdhaarModel.markSettled(id, user_id);
    if (!settled) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Udhaar marked as settled', udhaar: settled });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while settling udhaar' }, { status: 500 });
  }
}
