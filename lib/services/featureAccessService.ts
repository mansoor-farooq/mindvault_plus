import { NextResponse } from 'next/server';
import { db } from '../db.server';
import { FEATURE_ACCESS_CATALOG } from '../featureAccess';

/**
 * Merges the static catalog defaults with the user's paid license status, then applies any
 * per-user overrides an admin has explicitly set in user_feature_access (which always wins,
 * in either direction - an admin can both grant a VIP feature to a FREE user and revoke a
 * normally-free one from anybody, including a paid user).
 *
 * VIP features are unlocked by default for an active PRO or LIFETIME license - "VIP" is
 * meant to reward paying users, not require a separate manual admin grant on top of paying.
 * A FREE user (or an expired PRO) still gets the catalog default (VIP = disabled) unless an
 * admin explicitly grants it.
 */
export async function getUserFeatureAccess(userId: number): Promise<Record<string, boolean>> {
  const userRes = await db.query('SELECT license_type, license_expiry FROM users WHERE id = $1', [userId]);
  const licenseType = userRes.rows[0]?.license_type;
  const licenseExpiry = userRes.rows[0]?.license_expiry;
  const isExpiredPro = licenseType === 'PRO' && licenseExpiry && new Date(licenseExpiry) < new Date();
  const isPaidActive = (licenseType === 'PRO' && !isExpiredPro) || licenseType === 'LIFETIME';

  const access: Record<string, boolean> = {};
  for (const feature of FEATURE_ACCESS_CATALOG) {
    access[feature.key] = !feature.vip || isPaidActive;
  }

  const overrides = await db.query('SELECT feature_key, is_enabled FROM user_feature_access WHERE user_id = $1', [userId]);
  for (const row of overrides.rows) {
    access[row.feature_key] = row.is_enabled;
  }

  return access;
}

export async function setUserFeatureAccess(userId: number, featureKey: string, isEnabled: boolean) {
  await db.query(
    `
    INSERT INTO user_feature_access (user_id, feature_key, is_enabled, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, feature_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
    `,
    [userId, featureKey, isEnabled]
  );
}

/**
 * Server-side enforcement helper for feature-specific API routes. Returns true if the
 * user may use this feature right now (catalog default merged with their overrides).
 */
export async function hasFeatureAccess(userId: number, featureKey: string): Promise<boolean> {
  const access = await getUserFeatureAccess(userId);
  return access[featureKey] ?? true; // unknown/uncataloged keys are not gated
}

/**
 * Route-handler-style guard, mirroring requireAuth's shape: call at the top of a feature's
 * API route right after requireAuth, and return its result immediately if non-null.
 */
export async function requireFeatureAccess(userId: number, featureKey: string): Promise<NextResponse | null> {
  const allowed = await hasFeatureAccess(userId, featureKey);
  if (!allowed) {
    return NextResponse.json({ error: 'FEATURE_NOT_AVAILABLE', feature: featureKey }, { status: 403 });
  }
  return null;
}
