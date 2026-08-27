import { db } from '../db.server';

export interface ReminderCreateData {
  note_id: number;
  reminder_type: string;
  date_time: string;
  user_id: number;
}

export class ReminderModel {
  // Reminders have no user_id column of their own - ownership is always checked
  // via a join to the parent note, so a reminder can never be read/created/completed
  // against a note that belongs to a different user.
  static async create(reminderData: ReminderCreateData) {
    const { note_id, reminder_type, date_time, user_id } = reminderData;
    const query = `
      INSERT INTO reminders (note_id, reminder_type, date_time)
      SELECT $1, $2, $3
      WHERE EXISTS (SELECT 1 FROM notes WHERE id = $1 AND user_id = $4)
      RETURNING *;
    `;
    const values = [note_id, reminder_type, date_time, user_id];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findByNoteId(note_id: string, user_id: number) {
    const query = `
      SELECT r.* FROM reminders r
      JOIN notes n ON r.note_id = n.id
      WHERE r.note_id = $1 AND n.user_id = $2
      ORDER BY r.date_time ASC;
    `;
    const { rows } = await db.query(query, [note_id, user_id]);
    return rows;
  }

  static async markCompleted(id: string, user_id: number) {
    const query = `
      UPDATE reminders r SET is_completed = TRUE
      FROM notes n
      WHERE r.id = $1 AND r.note_id = n.id AND n.user_id = $2
      RETURNING r.*;
    `;
    const { rows } = await db.query(query, [id, user_id]);
    return rows[0];
  }
}
