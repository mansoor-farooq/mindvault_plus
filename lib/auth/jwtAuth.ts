import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from '../db.server';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

export interface AuthResult {
  ok: true;
  user: { id: number; [key: string]: unknown };
}

export interface AuthError {
  ok: false;
  status: number;
  error: string;
}

/**
 * Route-handler equivalent of the old Express jwtAuth middleware. Every
 * protected route calls this as its first line instead of relying on a
 * middleware chain. Preserves the live DB re-check on every call - a
 * BANNED/SUSPENDED account must be rejected even with a still-valid JWT.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'No token, authorization denied' };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; [key: string]: unknown };

    // Live DB check on every protected API call - DO NOT trust cached JWT status
    const result = await db.query('SELECT id, account_status, organization_id, org_role FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return { ok: false, status: 401, error: 'User no longer exists' };
    }

    const user = result.rows[0];
    if (user.account_status === 'BANNED' || user.account_status === 'SUSPENDED') {
      return { ok: false, status: 403, error: `Account is ${user.account_status}. Please contact support.` };
    }

    // Organization identity resolution: a MEMBER's data operations resolve to the
    // organization owner's id instead of their own, so every downstream ownership
    // check in this codebase (which all compare against a single user_id) transparently
    // treats the whole team as one shared data owner - no other query needs to change.
    let effectiveId = decoded.id;
    if (user.org_role === 'MEMBER' && user.organization_id) {
      const orgResult = await db.query('SELECT owner_user_id FROM organizations WHERE id = $1', [user.organization_id]);
      if (orgResult.rows.length > 0) {
        effectiveId = orgResult.rows[0].owner_user_id;
      }
    }

    return { ok: true, user: { ...decoded, id: effectiveId, actualUserId: decoded.id } };
  } catch {
    return { ok: false, status: 401, error: 'Token is not valid' };
  }
}
