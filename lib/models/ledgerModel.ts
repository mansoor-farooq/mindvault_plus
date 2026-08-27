import { db } from '../db.server';

export interface LedgerCreateData {
  user_id: number;
  type: string;
  amount: number;
  category?: string;
  note?: string;
  date: string;
  is_recurring?: boolean;
  attached_photo_path?: string | null;
}

export class LedgerModel {
  static async create(ledgerData: LedgerCreateData) {
    const { user_id, type, amount, category, note, date, is_recurring, attached_photo_path } = ledgerData;
    const query = `
      INSERT INTO ledger_entries (user_id, type, amount, category, note, date, is_recurring, attached_photo_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [user_id, type, amount, category, note, date, is_recurring, attached_photo_path];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findByUserId(user_id: number) {
    const query = `SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY date DESC`;
    const { rows } = await db.query(query, [user_id]);
    return rows;
  }
}
