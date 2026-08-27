import { NextRequest, NextResponse } from 'next/server';
import { UdhaarModel } from '../../../../../lib/models/udhaarModel';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const udhaars = await UdhaarModel.findByUserId(auth.user.id);
    return NextResponse.json({ udhaars });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching udhaars' }, { status: 500 });
  }
}
