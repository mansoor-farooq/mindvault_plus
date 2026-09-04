import { NextRequest, NextResponse } from 'next/server';
import { ReminderModel } from '../../../../../lib/models/reminderModel';
import { requireModuleAccess } from '../../../../../lib/auth/moduleGate';

export async function GET(req: NextRequest, { params }: { params: Promise<{ note_id: string }> }) {
  const gate = await requireModuleAccess(req, 'tools', 'view');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const { note_id } = await params;
    const reminders = await ReminderModel.findByNoteId(note_id, gate.user.id);
    return NextResponse.json({ reminders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching reminders' }, { status: 500 });
  }
}
