import { NextRequest, NextResponse } from 'next/server';
import * as driveService from '../../../../lib/services/googleDriveService';
import { adVerifier } from '../../../../lib/adVerifier';
import { requireAuth } from '../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../lib/services/featureAccessService';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'drive_backup');
  if (featureError) return featureError;

  if (!driveService.isConfigured()) {
    return NextResponse.json({ error: 'Google Drive is not configured on this server yet.' }, { status: 503 });
  }
  // The OAuth callback is a browser redirect (no Authorization header), so the
  // user's identity has to travel in `state` - reusing the ad system's signed
  // nonce means it's tamper-proof and time-limited without new crypto code.
  const state = adVerifier.generateNonce(auth.user.id, 'drive_connect');
  return NextResponse.json({ authUrl: driveService.getAuthUrl(state) });
}
