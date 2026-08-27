import { NextRequest, NextResponse } from 'next/server';
import { ReminderModel } from '../../../../../lib/models/reminderModel';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ note_id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { note_id } = await params;
    const reminders = await ReminderModel.findByNoteId(note_id, auth.user.id);
    return NextResponse.json({ reminders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching reminders' }, { status: 500 });
  }
}
