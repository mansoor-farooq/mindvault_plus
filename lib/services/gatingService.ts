import { db } from '../db.server';
import { FREE_LIMITS } from '../config/gatingConfig';
import { AI_TIER_LIMITS, PlanTier } from '../config/aiConfig';

interface CheckLimitResult {
  allowed: boolean;
  limit: number;
  active: number;
  bonus: number;
}

interface CheckQuotaResult {
  allowed: boolean;
  remaining: number;
}

class GatingService {
  /**
   * Checks if a user is allowed to create a new record for a given feature.
   * NOTE: This should ONLY be called for NEW inserts. Existing records (updates) bypass this.
   *
   * `licenseExpiry` matters because nothing else in the system ever re-checks it: an
   * expired PRO grant (license_type still 'PRO' in the DB until the daily downgrade
   * cron runs) must not keep bypassing quota limits in the meantime.
   */
  async checkLimit(userId: number, licenseType: string, featureKey: string, licenseExpiry: string | Date | null = null): Promise<CheckLimitResult> {
    const isExpiredPro = licenseType === 'PRO' && licenseExpiry && new Date(licenseExpiry) < new Date();
    if ((licenseType === 'PRO' && !isExpiredPro) || licenseType === 'LIFETIME') {
      return { allowed: true, limit: Infinity, active: 0, bonus: 0 };
    }

    const freeLimit = FREE_LIMITS[featureKey] || 0;

    const usageResult = await db.query(
      'SELECT bonus_quota FROM feature_usage WHERE user_id = $1 AND feature_key = $2',
      [userId, featureKey]
    );
    const bonusQuota = usageResult.rows.length > 0 ? usageResult.rows[0].bonus_quota : 0;

    let activeCount = 0;
    if (featureKey === 'khata_customers') {
      const result = await db.query(
        'SELECT COUNT(*) FROM khata_customers WHERE user_id = $1 AND is_deleted = false',
        [userId]
      );
      activeCount = parseInt(result.rows[0].count, 10);
    } else if (featureKey === 'products') {
      const result = await db.query(
        'SELECT COUNT(*) FROM products WHERE user_id = $1 AND is_deleted = false',
        [userId]
      );
      activeCount = parseInt(result.rows[0].count, 10);
    }

    const totalLimit = freeLimit + bonusQuota;
    const allowed = activeCount < totalLimit;

    return {
      allowed,
      limit: totalLimit,
      active: activeCount,
      bonus: bonusQuota,
    };
  }

  /**
   * Daily-call-count gating for AI features (Gemini calls cost real money/quota,
   * unlike row-count features like khata_customers). Resets at UTC midnight.
   * Additive to checkLimit - does not touch the row-count path used above.
   */
  async checkAndConsumeDailyQuota(userId: number, licenseType: string, featureKey: string, unusedOldLimit: number, licenseExpiry: string | Date | null = null): Promise<CheckQuotaResult> {
    const isExpired = licenseExpiry && new Date(licenseExpiry) < new Date();
    
    // Map licenseType to our structured PlanTier
    let tier: PlanTier = 'FREE';
    if (!isExpired) {
      if (licenseType === 'UNLIMITED' || licenseType === 'LIFETIME') tier = 'UNLIMITED';
      else if (licenseType === 'PRO_PLUS') tier = 'PRO_PLUS';
      else if (licenseType === 'PRO') tier = 'PRO';
    }

    if (tier === 'UNLIMITED') return { allowed: true, remaining: Infinity };

    // Get the dynamic limit based on the user's tier
    const dailyLimit = AI_TIER_LIMITS[tier][featureKey] || 0;

    // Single atomic UPSERT using Postgres's own CURRENT_DATE (not a JS-computed
    // date string) so the "is this still today" check never drifts between the
    // app server's timezone/clock and the DB's - that mismatch previously made
    // the reset-on-new-day branch fire on every call, so usage never accumulated.
    const result = await db.query(`
      INSERT INTO feature_usage (user_id, feature_key, daily_usage_count, usage_reset_date)
      VALUES ($1, $2, 1, CURRENT_DATE)
      ON CONFLICT (user_id, feature_key) DO UPDATE SET
        daily_usage_count = CASE WHEN feature_usage.usage_reset_date = CURRENT_DATE THEN feature_usage.daily_usage_count + 1 ELSE 1 END,
        usage_reset_date = CURRENT_DATE,
        updated_at = NOW()
      RETURNING daily_usage_count, bonus_quota
    `, [userId, featureKey]);

    const { daily_usage_count: usedCount, bonus_quota: bonusQuota } = result.rows[0];
    const totalLimit = dailyLimit + (bonusQuota || 0);

    if (usedCount > totalLimit) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: totalLimit - usedCount };
  }
}

export const gatingService = new GatingService();

