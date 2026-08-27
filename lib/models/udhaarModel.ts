import { db } from '../db.server';

export interface UdhaarCreateData {
  user_id: number;
  person_name: string;
  amount: number;
  type: string;
  due_date?: string | null;
  note?: string;
}

export class UdhaarModel {
  static async create(udhaarData: UdhaarCreateData) {
    const { user_id, person_name, amount, type, due_date, note } = udhaarData;
    const query = `
      INSERT INTO udhaar (user_id, person_name, amount, type, due_date, note)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [user_id, person_name, amount, type, due_date, note];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findByUserId(user_id: number) {
    const query = `SELECT * FROM udhaar WHERE user_id = $1 ORDER BY due_date ASC`;
    const { rows } = await db.query(query, [user_id]);
    return rows;
  }

  static async markSettled(id: string, user_id: number) {
    const query = `
      UPDATE udhaar SET is_settled = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, user_id]);
    return rows[0];
  }
}
