import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from '../db.server';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'supersecretmindvaultadmin';
export const ADMIN_COOKIE_NAME = 'admin_session';
// Mirrors the old express-session's effective lifetime. A stateless JWT cookie can't be
// force-invalidated before this expires the way a server-side session could - low-impact
// given the live DB re-check below already blocks a banned/demoted admin's very next request.
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24h

export interface AdminSessionPayload {
  adminId: number;
  adminName: string;
  adminRole: 'ADMIN' | 'SUPER_ADMIN';
}

export function signAdminToken(payload: AdminSessionPayload): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS });
}

export interface AdminAuthResult {
  ok: true;
  admin: AdminSessionPayload;
}
export interface AdminAuthError {
  ok: false;
  status: number;
  error: string;
}

/**
 * Route-handler equivalent of the old Express adminAuth middleware. Reads the
 * signed JWT from the httpOnly cookie (replacing express-session) and re-checks
 * the admin's role/ban status against the live DB on every call - the JWT payload
 * only identifies which admin to re-check, it's never trusted alone.
 */
export async function requireAdminAuth(req: NextRequest): Promise<AdminAuthResult | AdminAuthError> {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return { ok: false, status: 401, error: 'Admin authentication required' };
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as AdminSessionPayload;

    const result = await db.query('SELECT role, account_status FROM users WHERE id = $1', [decoded.adminId]);
    if (result.rows.length === 0) {
      return { ok: false, status: 401, error: 'Admin authentication required' };
    }
    const user = result.rows[0];
    if ((user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') || user.account_status === 'BANNED') {
      return { ok: false, status: 401, error: 'Admin authentication required' };
    }

    return { ok: true, admin: decoded };
  } catch {
    return { ok: false, status: 401, error: 'Admin authentication required' };
  }
}
