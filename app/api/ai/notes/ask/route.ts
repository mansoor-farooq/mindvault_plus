import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../../../../../lib/services/geminiClient';
import { findRelevantNotes } from '../../../../../lib/services/noteRetrievalService';
import { enforceQuota, localeContext } from '../../../../../lib/services/aiHelpers';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../../lib/services/featureAccessService';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'notes_ai');
  if (featureError) return featureError;

  try {
    const quotaError = await enforceQuota(auth.user.id, 'ai_notes_assist');
    if (quotaError) return quotaError;

    const { question, locale } = await req.json();
    if (!question || question.trim().length < 3) {
      return NextResponse.json({ error: 'Question is too short' }, { status: 400 });
    }

    // RAG only ever pulls this caller's own notes (userId is from the JWT, not
    // client input) - never another user's data.
    const relevantNotes = await findRelevantNotes(auth.user.id, question, 20);

    if (relevantNotes.length === 0) {
      return NextResponse.json({ answer: "You don't have any notes yet for me to search through.", sourceNoteIds: [] });
    }

    const context = relevantNotes
      .map((n: any, i: number) => `[Note ${i + 1}] Title: ${n.title}\nCategory: ${n.category || 'General'}\n${n.summary || n.description || ''}`)
      .join('\n\n')
      .slice(0, 60000); // 60,000 char budget cap

    const prompt = `${localeContext(locale)}Answer the user's question using ONLY the notes below. If the notes don't contain the answer, say so honestly - do not make things up.\n\n${context}\n\nQuestion: ${question}\n\nAnswer concisely:`;
    const answer = await generateText(prompt);

    return NextResponse.json({ answer: answer.trim(), sourceNoteIds: relevantNotes.map((n) => n.id) });
  } catch (error) {
    console.error('askNotes error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
