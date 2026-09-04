import { NextRequest, NextResponse } from 'next/server';
import { LedgerModel } from '../../../../../lib/models/ledgerModel';
import { requireModuleAccess } from '../../../../../lib/auth/moduleGate';

export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'roznamcha', 'view');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const entries = await LedgerModel.findByUserId(gate.user.id);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching ledger entries' }, { status: 500 });
  }
}
