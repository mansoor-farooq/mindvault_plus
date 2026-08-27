import { NextRequest, NextResponse } from 'next/server';
import { adVerifier } from '../../../../lib/adVerifier';
import { db } from '../../../../lib/db.server';
import { DAILY_AD_UNLOCK_LIMIT, AD_BONUS_REWARD } from '../../../../lib/config/gatingConfig';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // In a real AdMob callback, data often comes in query params or body depending on network
    const { user_id, custom_data } = body;
    // The caller (app/api/simulate-ad/route.ts) sends the HMAC in the x-ad-signature
    // header, not as a body field - reading it from a body field here meant it
    // was always undefined and this check effectively never passed.
    const signature = req.headers.get('x-ad-signature') || '';

    // 1. Verify Provider Signature
    if (!adVerifier.verifyProviderSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid provider signature' }, { status: 400 });
    }

    // 2. Verify Nonce & User Binding (Anti-Tamper)
    const expectedUserId = parseInt(user_id, 10);
    const nonceData = adVerifier.verifyNonce(custom_data, expectedUserId);

    if (!nonceData) {
      return NextResponse.json({ error: 'Invalid, tampered, or expired nonce' }, { status: 400 });
    }

    const { featureKey } = nonceData;

    // 3. Enforce Daily Limits & Increment Quota
    // Fetch current usage
    const usageRes = await db.query(
      'SELECT * FROM feature_usage WHERE user_id = $1 AND feature_key = $2',
      [expectedUserId, featureKey]
    );

    const usage = usageRes.rows[0];
    const today = new Date().toISOString().split('T')[0];
    let isNewDay = true;

    if (usage && usage.last_ad_view_at) {
      const lastViewDate = new Date(usage.last_ad_view_at).toISOString().split('T')[0];
      isNewDay = today !== lastViewDate;
    }

    const currentDailyViews = isNewDay ? 0 : usage ? usage.daily_ad_views : 0;

    if (currentDailyViews >= DAILY_AD_UNLOCK_LIMIT) {
      // Note: We don't rollback/error here for the ad provider, we just return 200 so they don't retry,
      // but we don't grant the reward.
      return NextResponse.json({ message: 'Daily limit reached' }, { status: 200 });
    }

    if (!usage) {
      await db.query(
        'INSERT INTO feature_usage (user_id, feature_key, bonus_quota, daily_ad_views, last_ad_view_at) VALUES ($1, $2, $3, $4, NOW())',
        [expectedUserId, featureKey, AD_BONUS_REWARD, 1]
      );
    } else {
      await db.query(
        'UPDATE feature_usage SET bonus_quota = bonus_quota + $1, daily_ad_views = $2, last_ad_view_at = NOW() WHERE user_id = $3 AND feature_key = $4',
        [AD_BONUS_REWARD, currentDailyViews + 1, expectedUserId, featureKey]
      );
    }

    return NextResponse.json({ message: 'Reward granted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error in rewardCallback:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
