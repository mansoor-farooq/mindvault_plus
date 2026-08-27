import { db } from '../db.server';

export interface NoteCreateData {
  user_id: number;
  title: string;
  description?: string;
  type: string;
  voice_path?: string | null;
  file_path?: string | null;
  category?: string;
  tags?: string[];
  reminder_date_time?: string | null;
}

export class NoteModel {
  static async create(noteData: NoteCreateData) {
    const { user_id, title, description, type, voice_path, file_path, category, tags, reminder_date_time } = noteData;
    const query = `
      INSERT INTO notes (user_id, title, description, type, voice_path, file_path, category, tags, reminder_date_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [user_id, title, description, type, voice_path, file_path, category, tags, reminder_date_time];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findByUserId(user_id: number, includeDeleted = false) {
    const query = `
      SELECT * FROM notes
      WHERE user_id = $1 AND is_deleted = $2
      ORDER BY created_at DESC;
    `;
    const { rows } = await db.query(query, [user_id, includeDeleted]);
    return rows;
  }

  static async softDelete(id: string, user_id: number) {
    const query = `
      UPDATE notes
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, user_id]);
    return rows[0];
  }

  static async findAll() {
    const query = 'SELECT * FROM notes ORDER BY created_at DESC';
    const { rows } = await db.query(query);
    return rows;
  }
}
