import { NextResponse } from 'next/server';
import * as googleAuthService from '../../../../../lib/services/googleAuthService';
import { generateOAuthState } from '../../../../../lib/services/oauthState';

export async function GET() {
  if (!googleAuthService.isConfigured()) {
    return NextResponse.json({ error: 'Google Sign-In is not configured on this server yet.' }, { status: 503 });
  }
  const state = generateOAuthState('google_signin');
  return NextResponse.json({ authUrl: googleAuthService.getAuthUrl(state) });
}
