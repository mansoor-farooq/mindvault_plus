import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as googleAuthService from '../../../../../lib/services/googleAuthService';
import { verifyOAuthState } from '../../../../../lib/services/oauthState';
import { UserModel } from '../../../../../lib/models/userModel';
import { logAuthEvent } from '../../../../../lib/auth/authLog';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

// Google redirects the browser here as a real page navigation (not a fetch call), so the
// result has to travel back to the client via a redirect too. It goes in the URL FRAGMENT
// (not a query string) so it's never sent to the server on the next request or logged
// server-side - /login reads it once on mount and immediately strips it from the URL.
function redirectWithError(req: NextRequest, message: string) {
  const url = new URL('/login', req.url);
  url.hash = `googleError=${encodeURIComponent(message)}`;
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state') || '';

  if (!verifyOAuthState(state, 'google_signin')) {
    return redirectWithError(req, 'Sign-in link expired or invalid - please try again.');
  }
  if (!code) {
    return redirectWithError(req, 'Google did not return an authorization code.');
  }

  try {
    const tokens = await googleAuthService.exchangeCodeForTokens(code);
    const profile = await googleAuthService.getUserInfo(tokens.access_token);

    if (!profile.email || !profile.email_verified) {
      logAuthEvent('WARN', 'GOOGLE_LOGIN_FAILED', profile.email || 'unknown', 'EMAIL_NOT_VERIFIED');
      return redirectWithError(req, 'Your Google email is not verified.');
    }

    let user = await UserModel.findByEmail(profile.email);
    if (!user) {
      // No usable password exists for a Google-created account - a random, never-typed
      // hash just satisfies the NOT NULL column; only Google Sign-In (or a future
      // set-password flow) can ever authenticate this account.
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, await bcrypt.genSalt(10));
      const created = await UserModel.create({
        full_name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        password_hash: passwordHash,
      });
      user = await UserModel.findByEmail(created.email);
      logAuthEvent('INFO', 'GOOGLE_REGISTER_SUCCESS', profile.email, 'SUCCESS', { userId: user?.id });
    } else {
      logAuthEvent('INFO', 'GOOGLE_LOGIN_SUCCESS', profile.email, 'SUCCESS', { userId: user.id });
    }

    if (!user) {
      return redirectWithError(req, 'Could not create your account. Please try again.');
    }
    if (user.account_status === 'BANNED' || user.account_status === 'SUSPENDED') {
      return redirectWithError(req, `Account is ${String(user.account_status).toLowerCase()}. Please contact support.`);
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const userPayload = encodeURIComponent(JSON.stringify({ id: user.id, full_name: user.full_name, email: user.email, status: user.account_status }));

    const url = new URL('/login', req.url);
    url.hash = `googleToken=${token}&googleUser=${userPayload}`;
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Google sign-in callback error:', error);
    return redirectWithError(req, 'Google sign-in failed. Please try again.');
  }
}
