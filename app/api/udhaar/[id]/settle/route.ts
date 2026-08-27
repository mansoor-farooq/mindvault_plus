import { NextRequest, NextResponse } from 'next/server';
import { UdhaarModel } from '../../../../../lib/models/udhaarModel';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const user_id = auth.user.id;

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
