import { NextRequest, NextResponse } from 'next/server';
import { UdhaarModel } from '../../../lib/models/udhaarModel';
import { requireAuth } from '../../../lib/auth/jwtAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const user_id = auth.user.id;
    const { person_name, amount, type, due_date, note } = await req.json();

    const udhaar = await UdhaarModel.create({ user_id, person_name, amount, type, due_date, note });

    return NextResponse.json({ message: 'Udhaar record created', udhaar }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while creating udhaar record' }, { status: 500 });
  }
}
