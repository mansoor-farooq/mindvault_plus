import { NextRequest, NextResponse } from 'next/server';
import { NoteModel } from '../../../lib/models/noteModel';
import { DocumentModel } from '../../../lib/models/documentModel';
import { requireModuleAccess } from '../../../lib/auth/moduleGate';

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'notes_ai', 'full');
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const user_id = gate.user.id;
    const { title, description, type, category, tags, reminder_date_time, document_details } = await req.json();
    // document_details would include file_name, file_path, folder, total_pages, cover_thumbnail

    // Create Note
    const note = await NoteModel.create({ user_id, title, description, type, category, tags, reminder_date_time });

    // If it's a Document, also create a record in documents table
    if (type === 'DOCUMENT' && document_details) {
      await DocumentModel.create({ note_id: note.id, ...document_details });
    }

    return NextResponse.json({ message: 'Note created successfully', note }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error while creating note' }, { status: 500 });
  }
}
