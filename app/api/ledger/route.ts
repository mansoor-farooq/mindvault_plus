import { NextRequest, NextResponse } from 'next/server';
import { LedgerModel } from '../../../lib/models/ledgerModel';
import { requireAuth } from '../../../lib/auth/jwtAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const user_id = auth.user.id;
    const { type, amount, category, note, date, is_recurring, attached_photo_path } = await req.json();

    const entry = await LedgerModel.create({ user_id, type, amount, category, note, date, is_recurring, attached_photo_path });

    return NextResponse.json({ message: 'Ledger entry added', entry }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while adding ledger entry' }, { status: 500 });
  }
}
