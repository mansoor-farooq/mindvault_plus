import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';
import { normalizeEmail } from '../../../../lib/utils';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { email, password, fullName } = await req.json();
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !password || password.length < 8) {
    return NextResponse.json({ error: 'A valid email and an 8+ character password are required' }, { status: 400 });
  }

  try {
    // Only the actual caller's own membership matters here (not the org-resolved id),
    // since inviting is an owner-only action - a member must never be able to invite.
    const callerRow = await db.query('SELECT org_role, organization_id FROM users WHERE id = $1', [auth.user.actualUserId]);
    const caller = callerRow.rows[0];
    if (!caller?.organization_id || caller.org_role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the organization owner can invite team members' }, { status: 403 });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `
      INSERT INTO users (full_name, email, password_hash, account_type, organization_id, org_role)
      VALUES ($1, $2, $3, 'ORGANIZATION', $4, 'MEMBER')
      RETURNING id, full_name, email, org_role, created_at
      `,
      [fullName || cleanEmail, cleanEmail, passwordHash, caller.organization_id]
    );

    return NextResponse.json({ success: true, member: result.rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
