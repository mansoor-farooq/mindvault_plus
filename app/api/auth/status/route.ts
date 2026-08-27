import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../../lib/models/userModel';
import { normalizeEmail } from '../../../../lib/utils';
import { logAuthEvent } from '../../../../lib/auth/authLog';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cleanEmail = normalizeEmail(body.email);
  if (!cleanEmail) {
    return NextResponse.json({ error: 'Email is required', reason: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      logAuthEvent('WARN', 'CHECK_STATUS_FAILED', cleanEmail, 'USER_NOT_FOUND');
      return NextResponse.json({ error: 'User not found', reason: 'USER_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ status: user.account_status || 'ACTIVE' });
  } catch (error) {
    logAuthEvent('ERROR', 'CHECK_STATUS_ERROR', cleanEmail, 'SERVER_ERROR', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error during status check', reason: 'SERVER_ERROR' }, { status: 500 });
  }
}
