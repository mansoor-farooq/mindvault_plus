import { NextRequest, NextResponse } from 'next/server';
import { NoteModel } from '../../../../../lib/models/noteModel';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Ownership is derived from the authenticated token, never from the URL param,
    // so one user can never enumerate another user's notes by changing :user_id.
    const notes = await NoteModel.findByUserId(auth.user.id);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while fetching notes' }, { status: 500 });
  }
}
