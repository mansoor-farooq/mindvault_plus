import { NextRequest, NextResponse } from 'next/server';
import { NoteModel } from '../../../../lib/models/noteModel';
import { requireAuth } from '../../../../lib/auth/jwtAuth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const user_id = auth.user.id;

    const deletedNote = await NoteModel.softDelete(id, user_id);
    if (!deletedNote) {
      return NextResponse.json({ error: 'Note not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Note moved to trash successfully', note: deletedNote });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while deleting note' }, { status: 500 });
  }
}
