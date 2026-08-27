import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../../lib/db.server';
import { signAdminToken, ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE_SECONDS } from '../../../../lib/auth/adminAuth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = result.rows[0];

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.account_status === 'BANNED' || user.account_status === 'SUSPENDED') {
      return NextResponse.json({ error: `Account is ${user.account_status.toLowerCase()}.` }, { status: 403 });
    }

    const token = signAdminToken({ adminId: user.id, adminName: user.full_name, adminRole: user.role });

    const res = NextResponse.json({ success: true, redirect: '/admin' });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: '/',
    });
    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
