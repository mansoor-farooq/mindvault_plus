import { db } from '../db.server';
import { normalizeEmail } from '../utils';

export interface User {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  account_status: string;
  created_at: string;
  [key: string]: unknown;
}

export class UserModel {
  /** Find a user by Email (case-insensitive & trimmed) */
  static async findByEmail(email: string): Promise<User | undefined> {
    const cleanEmail = normalizeEmail(email);
    const query = 'SELECT * FROM users WHERE LOWER(TRIM(email)) = $1';
    const { rows } = await db.query(query, [cleanEmail]);
    return rows[0];
  }

  /** Create a new user */
  static async create(userData: { full_name: string; email: string; password_hash: string }) {
    const { full_name, email, password_hash } = userData;
    const cleanEmail = normalizeEmail(email);
    const query = `
      INSERT INTO users (full_name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, full_name, email, account_status, created_at;
    `;
    const values = [full_name, cleanEmail, password_hash];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  /** Get all users (Useful for Admin Panel) */
  static async findAll() {
    const query = 'SELECT id, full_name, email, account_status, created_at FROM users ORDER BY created_at DESC';
    const { rows } = await db.query(query);
    return rows;
  }
}
