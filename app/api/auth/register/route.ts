import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { UserModel } from '../../../../lib/models/userModel';
import { normalizeEmail } from '../../../../lib/utils';
import { withAuthLock } from '../../../../lib/authLock';
import { logAuthEvent } from '../../../../lib/auth/authLog';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cleanEmail = normalizeEmail(body.email);
  const { full_name, password } = body;

  if (!cleanEmail || !password) {
    logAuthEvent('WARN', 'REGISTER_FAILED', cleanEmail, 'INVALID_INPUT');
    return NextResponse.json({ error: 'Email and password are required', reason: 'INVALID_INPUT' }, { status: 400 });
  }

  return withAuthLock(cleanEmail, async () => {
    try {
      const existingUser = await UserModel.findByEmail(cleanEmail);
      if (existingUser) {
        logAuthEvent('WARN', 'REGISTER_FAILED', cleanEmail, 'EMAIL_ALREADY_REGISTERED');
        return NextResponse.json({ error: 'Email already registered', reason: 'EMAIL_ALREADY_REGISTERED' }, { status: 400 });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const newUser = await UserModel.create({ full_name, email: cleanEmail, password_hash });
      logAuthEvent('INFO', 'REGISTER_SUCCESS', cleanEmail, 'SUCCESS', { userId: newUser.id });

      return NextResponse.json({ message: 'User registered successfully', user: newUser }, { status: 201 });
    } catch (error) {
      logAuthEvent('ERROR', 'REGISTER_ERROR', cleanEmail, 'SERVER_ERROR', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Server error during registration', reason: 'SERVER_ERROR' }, { status: 500 });
    }
  });
}
