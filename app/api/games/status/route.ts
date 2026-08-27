import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db.server';
import { requireAuth } from '../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../lib/services/featureAccessService';

const QUIZ_DAILY_ANSWER_LIMIT = 20; // anti-farming cap, applies to every tier
const QUIZ_REDEEM_COST = 10; // mindcoins
const QUIZ_REDEEM_AI_BONUS = 5; // ai_notes_assist bonus_quota granted per redemption

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'money_quiz');
  if (featureError) return featureError;

  try {
    const userId = auth.user.id;
    const coinsRes = await db.query(`SELECT bonus_quota FROM feature_usage WHERE user_id = $1 AND feature_key = 'mindcoins'`, [userId]);
    // Comparing usage_reset_date to CURRENT_DATE server-side (not in JS) avoids the
    // timezone-mismatch bug that previously broke the AI daily-quota counter.
    const capRes = await db.query(
      `SELECT CASE WHEN usage_reset_date = CURRENT_DATE THEN daily_usage_count ELSE 0 END as answered_today
       FROM feature_usage WHERE user_id = $1 AND feature_key = 'quiz_answers'`,
      [userId]
    );
    return NextResponse.json({
      mindcoins: coinsRes.rows[0]?.bonus_quota || 0,
      answeredToday: capRes.rows[0]?.answered_today || 0,
      dailyLimit: QUIZ_DAILY_ANSWER_LIMIT,
      redeemCost: QUIZ_REDEEM_COST,
      redeemAiBonus: QUIZ_REDEEM_AI_BONUS,
    });
  } catch (error) {
    console.error('getStatus error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
