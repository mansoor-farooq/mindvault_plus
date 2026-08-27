import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/services/geminiClient';
import { requireAuth } from '@/lib/auth/jwtAuth';
import { enforceQuota } from '@/lib/services/aiHelpers';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const quotaError = await enforceQuota(auth.user.id, 'ai_udhaar_reminder');
  if (quotaError) return quotaError;

  try {
    const { name, amount } = await req.json();

    const prompt = \You are an AI assistant helping a Pakistani user ask for their loaned money (Udhaar) back.
The customer/friend's name is '\'.
The amount they owe is 'Rs \'.

Write a single, highly polite, respectful, and slightly informal WhatsApp message in Roman Urdu. 
The goal is to ask for the money back without sounding rude or ruining the relationship (sharam-free).
Do not include any English translation or extra text. Just the exact WhatsApp message.

Example tone: "Assalam o Alaikum \ bhai! Umeed hai aap theek honge. Ek choti si request thi..."\;

    const message = await generateText(prompt);

    return NextResponse.json({ message: message.trim() });
  } catch (error) {
    console.error('Udhaar reminder error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: String(error) }, { status: 502 });
  }
}

