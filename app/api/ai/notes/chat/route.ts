import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../../../../../lib/services/geminiClient';
import { enforceQuota } from '../../../../../lib/services/aiHelpers';
import { requireAuth } from '../../../../../lib/auth/jwtAuth';
import { requireFeatureAccess } from '../../../../../lib/services/featureAccessService';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureError = await requireFeatureAccess(auth.user.id, 'notes_ai');
  if (featureError) return featureError;

  try {
    const { note, history, message, audio } = await req.json();
    if (!note || !note.title) {
      return NextResponse.json({ error: 'Note context is required' }, { status: 400 });
    }

    const isVoiceMessage = !!(audio?.base64 && audio?.mimeType);
    if (isVoiceMessage) {
      // Voice messaging is strictly paid/admin-granted - no ad-quota bypass exists for
      // this at all (requireFeatureAccess is a hard gate, unlike enforceQuota below).
      const voiceFeatureError = await requireFeatureAccess(auth.user.id, 'notes_voice_chat');
      if (voiceFeatureError) return voiceFeatureError;
    } else if (!message || message.trim().length < 1) {
      return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
    }

    const quotaError = await enforceQuota(auth.user.id, 'ai_notes_assist');
    if (quotaError) return quotaError;

    const noteContext = [
      `Title: ${note.title}`,
      note.category ? `Category: ${note.category}` : null,
      note.tags?.length ? `Tags: ${note.tags.join(', ')}` : null,
      note.summary ? `Summary: ${note.summary}` : null,
      note.description ? `Content: ${note.description}` : null,
    ].filter(Boolean).join('\n');

    const conversation = ((history || []) as ChatTurn[])
      .slice(-20) // char/turn budget cap, same spirit as ask's 6000-char context cap
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n');

    // Unlike summarize/ask (which should match the NOTE's own language), a live chat
    // must follow whatever language the USER is typing/speaking in turn-by-turn -
    // someone can write an English note and then chat about it in Urdu/Roman Urdu, and
    // the reply should match the chat message, not the note content, or every reply
    // comes back in the wrong language the moment the two differ.
    const persona = `You are MindVault's AI assistant, helping the user develop and refine the idea captured in this note. Be conversational, ask clarifying questions when useful, and offer concrete next steps or angles they may not have considered. Do not repeat the note content back verbatim - build on it. Always reply in the same language and style the user's latest message is written in (including Roman Urdu/Hindi if that's what they're using) - do not switch to the note's own language or to English unless the user does.`;
    const historyBlock = `Note:\n${noteContext}\n\n${conversation ? `Conversation so far:\n${conversation}\n\n` : ''}`;

    if (isVoiceMessage) {
      const prompt = `${persona} The user sent a voice message instead of typing - listen to the attached audio.\n\n${historyBlock}Respond with ONLY a JSON object of the form {"transcript": "<what the user said, transcribed>", "reply": "<your conversational reply>"}, nothing else.`;
      const raw = await generateText(prompt, { jsonMode: true, audio: { mimeType: audio.mimeType, base64: audio.base64 } });
      let parsed: { transcript?: string; reply?: string } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Fall through to the AI_UNAVAILABLE response below via the missing-fields check.
      }
      if (!parsed.transcript || !parsed.reply) {
        return NextResponse.json({ error: 'AI_UNAVAILABLE', message: 'Could not understand the voice message' }, { status: 502 });
      }
      return NextResponse.json({ transcript: parsed.transcript.trim(), reply: parsed.reply.trim() });
    }

    const prompt = `${persona}\n\n${historyBlock}User: ${message}\n\nAssistant:`;
    const reply = await generateText(prompt);
    return NextResponse.json({ reply: reply.trim() });
  } catch (error) {
    console.error('noteChat error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
