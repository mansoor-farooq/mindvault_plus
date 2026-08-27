import { db } from '../db.server';

export interface DocumentCreateData {
  note_id: number;
  file_name?: string;
  file_path?: string;
  folder?: string;
  total_pages?: number;
  cover_thumbnail?: string | null;
}

export class DocumentModel {
  static async create(docData: DocumentCreateData) {
    const { note_id, file_name, file_path, folder, total_pages, cover_thumbnail } = docData;
    const query = `
      INSERT INTO documents (note_id, file_name, file_path, folder, total_pages, cover_thumbnail)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [note_id, file_name, file_path, folder, total_pages, cover_thumbnail];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findByNoteId(note_id: number) {
    const query = `SELECT * FROM documents WHERE note_id = $1`;
    const { rows } = await db.query(query, [note_id]);
    return rows[0];
  }

  static async updateProgress(id: number, last_page_read: number, time_spent_minutes: number, read_status: string) {
    const query = `
      UPDATE documents
      SET last_page_read = $2, time_spent_minutes = time_spent_minutes + $3, read_status = $4
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, last_page_read, time_spent_minutes, read_status]);
    return rows[0];
  }
}
