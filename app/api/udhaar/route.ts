import { NextRequest, NextResponse } from 'next/server';
import { UdhaarModel } from '../../../lib/models/udhaarModel';
import { requireModuleAccess } from '../../../lib/auth/moduleGate';

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'khata', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const user_id = gate.user.id;
    const { person_name, amount, type, due_date, note } = await req.json();

    const udhaar = await UdhaarModel.create({ user_id, person_name, amount, type, due_date, note });

    return NextResponse.json({ message: 'Udhaar record created', udhaar }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while creating udhaar record' }, { status: 500 });
  }
}
