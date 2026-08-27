import { NextRequest, NextResponse } from 'next/server';
import * as driveService from '../../../../lib/services/googleDriveService';
import { adVerifier } from '../../../../lib/adVerifier';
import { db } from '../../../../lib/db.server';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Public: Google redirects the browser here directly, no Authorization header available.
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const oauthError = req.nextUrl.searchParams.get('error');

    if (oauthError) {
      return NextResponse.redirect(`${FRONTEND_URL}/settings?drive=denied`);
    }
    if (!code || !state) {
      return NextResponse.redirect(`${FRONTEND_URL}/settings?drive=error`);
    }

    const parsedUserId = parseInt(state.split(':')[0], 10);
    const nonceData = adVerifier.verifyNonce(state, parsedUserId);
    if (!nonceData || nonceData.featureKey !== 'drive_connect') {
      return NextResponse.redirect(`${FRONTEND_URL}/settings?drive=invalid_state`);
    }

    const tokens = await driveService.exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on first consent; if the user
      // already granted access before, they'd need to revoke it first to get one.
      return NextResponse.redirect(`${FRONTEND_URL}/settings?drive=no_refresh_token`);
    }

    await db.query(
      'UPDATE users SET google_drive_refresh_token = $1, google_drive_connected_at = NOW() WHERE id = $2',
      [tokens.refresh_token, parsedUserId]
    );

    return NextResponse.redirect(`${FRONTEND_URL}/settings?drive=connected`);
  } catch (error) {
    console.error('Drive callback error:', error);
    return NextResponse.redirect(`${FRONTEND_URL}/settings?drive=error`);
  }
}
