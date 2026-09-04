import { NextRequest, NextResponse } from 'next/server';
import { UdhaarModel } from '../../../../../lib/models/udhaarModel';
import { requireModuleAccess } from '../../../../../lib/auth/moduleGate';

export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'khata', 'view');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const udhaars = await UdhaarModel.findByUserId(gate.user.id);
    return NextResponse.json({ udhaars });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching udhaars' }, { status: 500 });
  }
}
