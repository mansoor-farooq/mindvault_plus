import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../lib/services/featureAccessService';

const QUIZ_REDEEM_COST = 10; // mindcoins
const QUIZ_REDEEM_AI_BONUS = 5; // ai_notes_assist bonus_quota granted per redemption

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'money_quiz');
  if (featureError) return featureError;

  try {
    const userId = auth.user.id;
    const coinsRes = await db.query(`SELECT bonus_quota FROM feature_usage WHERE user_id = $1 AND feature_key = 'mindcoins'`, [userId]);
    const coins = coinsRes.rows[0]?.bonus_quota || 0;

    if (coins < QUIZ_REDEEM_COST) {
      return NextResponse.json({ error: 'INSUFFICIENT_COINS', have: coins, need: QUIZ_REDEEM_COST }, { status: 400 });
    }

    // WHERE bonus_quota >= cost guards against a race between two concurrent
    // redemptions both reading a balance that's only enough for one of them.
    const spendRes = await db.query(
      `UPDATE feature_usage SET bonus_quota = bonus_quota - $1, updated_at = NOW() WHERE user_id = $2 AND feature_key = 'mindcoins' AND bonus_quota >= $1 RETURNING id`,
      [QUIZ_REDEEM_COST, userId]
    );
    if (spendRes.rowCount === 0) {
      return NextResponse.json({ error: 'INSUFFICIENT_COINS', have: coins, need: QUIZ_REDEEM_COST }, { status: 400 });
    }
    await db.query(
      `
      INSERT INTO feature_usage (user_id, feature_key, bonus_quota)
      VALUES ($1, 'ai_notes_assist', $2)
      ON CONFLICT (user_id, feature_key) DO UPDATE SET bonus_quota = feature_usage.bonus_quota + $2, updated_at = NOW()
    `,
      [userId, QUIZ_REDEEM_AI_BONUS]
    );

    return NextResponse.json({ success: true, coinsSpent: QUIZ_REDEEM_COST, aiQuotaGained: QUIZ_REDEEM_AI_BONUS });
  } catch (error) {
    console.error('redeemCoins error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
