import { NextRequest, NextResponse } from 'next/server';
import { LedgerModel } from '../../../lib/models/ledgerModel';
import { requireModuleAccess } from '../../../lib/auth/moduleGate';

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'roznamcha', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const user_id = gate.user.id;
    const { type, amount, category, note, date, is_recurring, attached_photo_path } = await req.json();

    const entry = await LedgerModel.create({ user_id, type, amount, category, note, date, is_recurring, attached_photo_path });

    return NextResponse.json({ message: 'Ledger entry added', entry }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while adding ledger entry' }, { status: 500 });
  }
}
