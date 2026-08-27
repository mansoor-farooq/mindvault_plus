import crypto from 'crypto';

// Signed, expiring CSRF token for OAuth `state` params - same signed-nonce technique as
// lib/adVerifier.ts, but for flows with no logged-in user yet (sign-in itself), so there's
// no userId to bind to.
const STATE_SECRET = process.env.AD_SECRET || 'super_secret_ad_key_mindvault_123';
const STATE_EXPIRY_MS = 5 * 60 * 1000;

export function generateOAuthState(purpose: string): string {
  const timestamp = Date.now();
  const payload = `${purpose}:${timestamp}`;
  const signature = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

export function verifyOAuthState(state: string, expectedPurpose: string): boolean {
  if (!state) return false;
  const parts = state.split(':');
  if (parts.length !== 3) return false;
  const [purpose, timestampStr, signature] = parts;
  if (purpose !== expectedPurpose) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (!timestamp || Date.now() - timestamp > STATE_EXPIRY_MS) return false;

  const payload = `${purpose}:${timestamp}`;
  const expectedSignature = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
  return signature === expectedSignature;
}
