import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/services/geminiClient';
import { localeContext, enforceQuota } from '@/lib/services/aiHelpers';
import { requireAuth } from '@/lib/auth/jwtAuth';
import { requireFeatureAccess } from '@/lib/services/featureAccessService';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const featureError = await requireFeatureAccess(auth.user.id, 'notes_ai');
  if (featureError) return featureError;

  try {
    const quotaError = await enforceQuota(auth.user.id, 'ai_voice_transcribe');
    if (quotaError) return quotaError;

    const { audioBase64, mimeType = 'audio/webm', locale } = await req.json();

    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
    }

    const prompt = `${localeContext(locale)}You are an expert audio transcription assistant. 
Please transcribe this voice recording accurately. 
Also generate:
1. A concise 3-6 word title.
2. A 1-2 sentence summary.
3. Up to 4 relevant tags.
4. An optional list of action items / to-dos extracted from the voice note.

Respond with ONLY a valid JSON object in this exact schema:
{
  "title": "Title here",
  "transcript": "Full text transcription here",
  "summary": "Short summary here",
  "tags": ["Tag1", "Tag2"],
  "actionItems": ["Action 1", "Action 2"]
}`;

    const rawResponse = await generateText(prompt, {
      audio: { mimeType, base64: audioBase64 },
      jsonMode: true,
    });

    let result;
    try {
      result = JSON.parse(rawResponse);
    } catch {
      result = { title: 'Voice Note', transcript: rawResponse, summary: '', tags: ['Voice'] };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Audio transcribe error:', error);
    return NextResponse.json(
      { error: 'AI_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
