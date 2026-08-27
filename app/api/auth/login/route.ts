import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../../../../lib/models/userModel';
import { normalizeEmail } from '../../../../lib/utils';
import { withAuthLock } from '../../../../lib/authLock';
import { logAuthEvent } from '../../../../lib/auth/authLog';
import { db } from '../../../../lib/db.server';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cleanEmail = normalizeEmail(body.email);
  const { password } = body;

  if (!cleanEmail || !password) {
    logAuthEvent('WARN', 'LOGIN_FAILED', cleanEmail, 'INVALID_INPUT');
    return NextResponse.json({ error: 'Invalid email or password', reason: 'INVALID_INPUT' }, { status: 400 });
  }

  return withAuthLock(cleanEmail, async () => {
    try {
      const user = await UserModel.findByEmail(cleanEmail);
      if (!user) {
        logAuthEvent('WARN', 'LOGIN_FAILED', cleanEmail, 'USER_NOT_FOUND');
        return NextResponse.json({ error: 'Invalid email or password', reason: 'USER_NOT_FOUND' }, { status: 400 });
      }

      if (user.account_status === 'BANNED' || user.account_status === 'SUSPENDED') {
        logAuthEvent('WARN', 'LOGIN_FAILED', cleanEmail, `ACCOUNT_${user.account_status}`, { status: user.account_status });
        return NextResponse.json(
          { error: `Account is ${user.account_status}. Please contact support.`, reason: `ACCOUNT_${user.account_status}` },
          { status: 403 }
        );
      }

      let isMatch = await bcrypt.compare(password, user.password_hash);

      // If user registered offline and synced via syncLogin (dummy hash present), update hash upon valid first login
      if (!isMatch && user.password_hash === 'dummy_hash_for_sync') {
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(password, salt);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
        isMatch = true;
        logAuthEvent('INFO', 'PASSWORD_HASH_UPGRADED', cleanEmail, 'OFFLINE_REGISTRATION_SYNCED');
      }

      if (!isMatch) {
        logAuthEvent('WARN', 'LOGIN_FAILED', cleanEmail, 'INVALID_PASSWORD');
        return NextResponse.json({ error: 'Invalid email or password', reason: 'INVALID_PASSWORD' }, { status: 400 });
      }

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
      logAuthEvent('INFO', 'LOGIN_SUCCESS', cleanEmail, 'SUCCESS', { userId: user.id });

      return NextResponse.json({
        message: 'Login successful',
        token,
        user: { id: user.id, full_name: user.full_name, email: user.email, status: user.account_status },
      });
    } catch (error) {
      logAuthEvent('ERROR', 'LOGIN_ERROR', cleanEmail, 'SERVER_ERROR', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Server error during login', reason: 'SERVER_ERROR' }, { status: 500 });
    }
  });
}
