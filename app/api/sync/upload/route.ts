import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';

// Web request.formData() replaces multer. Preserves the exact filename scheme
// (Date.now() + extname) and disk location (public/uploads/) the Express backend used,
// so existing DB-stored /uploads/<filename> paths keep resolving with zero data migration -
// Next.js already serves public/ at the site root.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const noteId = formData.get('noteId') as string | null;
    const type = formData.get('type') as string | null;
    const userId = auth.user.id;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const filename = `${Date.now()}${path.extname(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(process.cwd(), 'public', 'uploads', filename), buffer);

    const filePath = `/uploads/${filename}`;

    // Update note in DB
    if (type === 'audio') {
      await db.query(`UPDATE notes SET voice_path = $1, updated_at = NOW() WHERE frontend_id = $2 AND user_id = $3`, [filePath, noteId, userId]);
    } else {
      await db.query(`UPDATE notes SET file_path = $1, updated_at = NOW() WHERE frontend_id = $2 AND user_id = $3`, [filePath, noteId, userId]);
    }

    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Server error during file upload' }, { status: 500 });
  }
}
