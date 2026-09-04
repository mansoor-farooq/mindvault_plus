import { NextRequest, NextResponse } from 'next/server';
import { NoteModel } from '../../../../../lib/models/noteModel';
import { requireModuleAccess } from '../../../../../lib/auth/moduleGate';

export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'notes_ai', 'view');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    // Ownership is derived from the authenticated token, never from the URL param,
    // so one user can never enumerate another user's notes by changing :user_id.
    const notes = await NoteModel.findByUserId(gate.user.id);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching notes' }, { status: 500 });
  }
}
