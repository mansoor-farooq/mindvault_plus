import { NextResponse } from 'next/server';
import { db } from '../db.server';
import { gatingService } from './gatingService';
import { AI_TIER_LIMITS } from '../config/aiConfig';

export async function getUserLicense(userId: number) {
  const result = await db.query('SELECT license_type, license_expiry FROM users WHERE id = $1', [userId]);
  return result.rows[0] || { license_type: 'FREE', license_expiry: null };
}

// The frontend sends the browser's own locale (navigator.language, e.g. "ur-PK",
// "en-IN") - free, no geolocation service needed, and it's what actually determines
// currency/units/language expectations. Without this, Gemini defaults to US/English
// assumptions that are wrong for most of this app's users.
export function localeContext(locale?: string): string {
  if (!locale || typeof locale !== 'string') return '';
  return `The user's locale is ${locale}. Respond in the same language as their note content; if the content is in English, respond in English. Use locally-appropriate currency/number conventions only if the note itself implies a currency - do not assume USD.\n\n`;
}

export async function enforceQuota(userId: number, featureKey: string): Promise<NextResponse | null> {
  const user = await getUserLicense(userId);
  const quota = await gatingService.checkAndConsumeDailyQuota(userId, user.license_type, featureKey, 0 /* Looked up inside gatingService */, user.license_expiry);
  if (!quota.allowed) {
    return NextResponse.json({ error: 'AI_LIMIT_REACHED', feature: featureKey }, { status: 403 });
  }
  return null;
}

