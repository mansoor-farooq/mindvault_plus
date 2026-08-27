import { NextRequest, NextResponse } from 'next/server';
import { LedgerModel } from '../../../../../lib/models/ledgerModel';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const entries = await LedgerModel.findByUserId(auth.user.id);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching ledger entries' }, { status: 500 });
  }
}
