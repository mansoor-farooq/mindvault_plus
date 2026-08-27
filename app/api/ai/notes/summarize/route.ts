import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../../../../../lib/services/geminiClient';
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

    const { title, description, audio, locale } = await req.json();

    let summary: string;
    if (audio?.base64 && audio?.mimeType) {
      const prompt = `${localeContext(locale)}Listen to the attached audio recording and summarize it in 1-2 short sentences. Be concise and factual, do not add information that isn't there. Respond with only the summary text, nothing else.\n\nTitle: ${title || '(untitled)'}`;
      summary = await generateText(prompt, { audio: { mimeType: audio.mimeType, base64: audio.base64 } });
    } else {
      if (!description || description.trim().length < 10) {
        return NextResponse.json({ error: 'Note description is too short to summarize' }, { status: 400 });
      }
      const prompt = `${localeContext(locale)}Summarize the following note in 1-2 short sentences. Be concise and factual, do not add information that isn't there. Respond with only the summary text, nothing else.\n\nTitle: ${title || '(untitled)'}\nContent: ${description}`;
      summary = await generateText(prompt);
    }

    return NextResponse.json({ summary: summary.trim() });
  } catch (error) {
    console.error('summarizeNote error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
