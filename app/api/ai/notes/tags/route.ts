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

    const { title, description, locale } = await req.json();
    if (!title && !description) {
      return NextResponse.json({ error: 'Note has no content to tag' }, { status: 400 });
    }

    const prompt = `${localeContext(locale)}Suggest up to 4 short, single-word or two-word tags for this note (e.g. Work, Finance, Health, Urgent). Respond with ONLY a JSON array of strings, nothing else, e.g. ["Work","Urgent"].\n\nTitle: ${title || '(untitled)'}\nContent: ${description || ''}`;
    const raw = await generateText(prompt, { jsonMode: true });

    let tags: unknown[] = [];
    try {
      tags = JSON.parse(raw);
      if (!Array.isArray(tags)) tags = [];
    } catch {
      tags = [];
    }
    const cleanTags = tags.filter((t) => typeof t === 'string').slice(0, 4);

    return NextResponse.json({ tags: cleanTags });
  } catch (error) {
    console.error('suggestTags error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
