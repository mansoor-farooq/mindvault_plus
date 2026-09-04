import { NextRequest, NextResponse } from 'next/server';
import { ReminderModel } from '../../../lib/models/reminderModel';
import { requireModuleAccess } from '../../../lib/auth/moduleGate';

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'tools', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const { note_id, reminder_type, date_time } = await req.json();

    const reminder = await ReminderModel.create({ note_id, reminder_type, date_time, user_id: gate.user.id });
    if (!reminder) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reminder created', reminder }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while creating reminder' }, { status: 500 });
  }
}
