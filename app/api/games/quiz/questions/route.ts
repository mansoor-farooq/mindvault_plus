import { NextRequest, NextResponse } from 'next/server';
import { QUIZ_QUESTIONS } from '../../../../../lib/config/quizQuestions';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../../lib/services/featureAccessService';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'money_quiz');
  if (featureError) return featureError;

  // Correct answers/explanations are never sent to the client until after answering.
  const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
  return NextResponse.json({ questions: shuffled.map(({ correctIndex, explanation, ...q }) => q) });
}
