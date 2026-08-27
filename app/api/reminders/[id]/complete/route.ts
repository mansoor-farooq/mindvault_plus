import { NextRequest, NextResponse } from 'next/server';
import { ReminderModel } from '../../../../../lib/models/reminderModel';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;

    const completed = await ReminderModel.markCompleted(id, auth.user.id);
    if (!completed) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reminder marked as completed', reminder: completed });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while updating reminder' }, { status: 500 });
  }
}
