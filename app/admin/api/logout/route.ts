import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '../../../../lib/auth/adminAuth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
