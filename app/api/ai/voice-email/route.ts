import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../../../../lib/services/geminiClient';
import { enforceQuota } from '../../../../lib/services/aiHelpers';
import { requireAuth } from '../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../lib/services/featureAccessService';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  // Strict paid/admin-grant-only gate - no ad-bypass path exists for this at all.
  const featureError = await requireFeatureAccess(auth.user.id, 'voice_email');
  if (featureError) return featureError;

  try {
    const quotaError = await enforceQuota(auth.user.id, 'ai_voice_transcribe');
    if (quotaError) return quotaError;

    const { audio } = await req.json();
    if (!audio?.base64 || !audio?.mimeType) {
      return NextResponse.json({ error: 'Audio recording is required' }, { status: 400 });
    }

    const prompt = `Listen to the attached voice message and turn it into a clear, professional email. Infer a short, specific subject line from what was said. Write the body in the same language the speaker used. Respond with ONLY a JSON object of the form {"subject": "<subject line>", "body": "<email body>"}, nothing else.`;
    const raw = await generateText(prompt, { jsonMode: true, audio: { mimeType: audio.mimeType, base64: audio.base64 } });

    let parsed: { subject?: string; body?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Falls through to the missing-fields check below.
    }
    if (!parsed.subject || !parsed.body) {
      return NextResponse.json({ error: 'AI_UNAVAILABLE', message: 'Could not understand the voice message' }, { status: 502 });
    }

    return NextResponse.json({ subject: parsed.subject.trim(), body: parsed.body.trim() });
  } catch (error) {
    console.error('voiceEmail error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
