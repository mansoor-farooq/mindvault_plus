// Raw REST calls to Google's OAuth2 endpoints, same style as googleDriveService.ts -
// reuses the SAME OAuth client (GOOGLE_DRIVE_CLIENT_ID/SECRET) since it's the same Google
// Cloud project, just with a different redirect URI and a much smaller scope (identity
// only, not Drive access). The redirect URI below must be added to that OAuth client's
// "Authorized redirect URIs" list in Google Cloud Console before this will work.
const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_SIGNIN_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

const SCOPE = 'openid email profile';

export function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID || '',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID || '',
      client_secret: CLIENT_SECRET || '',
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json(); // { access_token, id_token, expires_in, ... }
}

export async function getUserInfo(accessToken: string): Promise<{ sub: string; email: string; email_verified: boolean; name?: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Fetching Google user info failed: ${await res.text()}`);
  return res.json();
}
