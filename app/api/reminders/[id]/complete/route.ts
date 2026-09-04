import { NextRequest, NextResponse } from 'next/server';
import { ReminderModel } from '../../../../../lib/models/reminderModel';
import { requireModuleAccess } from '../../../../../lib/auth/moduleGate';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireModuleAccess(req, 'tools', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const { id } = await params;

    const completed = await ReminderModel.markCompleted(id, gate.user.id);
    if (!completed) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reminder marked as completed', reminder: completed });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while updating reminder' }, { status: 500 });
  }
}
