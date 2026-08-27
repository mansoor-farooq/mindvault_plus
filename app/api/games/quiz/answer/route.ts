import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db.server';
import { QUIZ_QUESTIONS } from '../../../../../lib/config/quizQuestions';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../../lib/services/featureAccessService';

const QUIZ_DAILY_ANSWER_LIMIT = 20;
const QUIZ_POINTS_PER_CORRECT = 2;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'money_quiz');
  if (featureError) return featureError;

  try {
    const userId = auth.user.id;
    const { questionId, answerIndex } = await req.json();
    const question = QUIZ_QUESTIONS.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const capResult = await db.query(
      `
      INSERT INTO feature_usage (user_id, feature_key, daily_usage_count, usage_reset_date)
      VALUES ($1, 'quiz_answers', 1, CURRENT_DATE)
      ON CONFLICT (user_id, feature_key) DO UPDATE SET
        daily_usage_count = CASE WHEN feature_usage.usage_reset_date = CURRENT_DATE THEN feature_usage.daily_usage_count + 1 ELSE 1 END,
        usage_reset_date = CURRENT_DATE,
        updated_at = NOW()
      RETURNING daily_usage_count
    `,
      [userId]
    );

    if (capResult.rows[0].daily_usage_count > QUIZ_DAILY_ANSWER_LIMIT) {
      return NextResponse.json({ error: 'QUIZ_DAILY_LIMIT_REACHED', limit: QUIZ_DAILY_ANSWER_LIMIT }, { status: 403 });
    }

    const isCorrect = question.correctIndex === answerIndex;
    let pointsAwarded = 0;
    if (isCorrect) {
      pointsAwarded = QUIZ_POINTS_PER_CORRECT;
      await db.query(
        `
        INSERT INTO feature_usage (user_id, feature_key, bonus_quota)
        VALUES ($1, 'mindcoins', $2)
        ON CONFLICT (user_id, feature_key) DO UPDATE SET bonus_quota = feature_usage.bonus_quota + $2, updated_at = NOW()
      `,
        [userId, pointsAwarded]
      );
    }

    const coinsRes = await db.query(`SELECT bonus_quota FROM feature_usage WHERE user_id = $1 AND feature_key = 'mindcoins'`, [userId]);

    return NextResponse.json({
      correct: isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      pointsAwarded,
      totalMindcoins: coinsRes.rows[0]?.bonus_quota || 0,
    });
  } catch (error) {
    console.error('submitAnswer error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
