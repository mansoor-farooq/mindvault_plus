import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/services/geminiClient';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { enforceQuota } from '@/lib/services/aiHelpers';

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'khata', 'view');
  if (!gate.ok) return gate.response;

  const quotaError = await enforceQuota(gate.businessId, 'ai_udhaar_reminder');
  if (quotaError) return quotaError;

  try {
    const { name, amount } = await req.json();

    const prompt = `You are an AI assistant helping a Pakistani user ask for their loaned money (Udhaar) back.
The customer/friend's name is '${name}'.
The amount they owe is 'Rs ${amount}'.

Write a single, highly polite, respectful, and slightly informal WhatsApp message in Roman Urdu. 
The goal is to ask for the money back without sounding rude or ruining the relationship (sharam-free).
Do not include any English translation or extra text. Just the exact WhatsApp message.

Example tone: "Assalam o Alaikum ${name} bhai! Umeed hai aap theek honge. Ek choti si request thi..."`;

    const message = await generateText(prompt);

    return NextResponse.json({ message: message.trim() });
  } catch (error) {
    console.error('Udhaar reminder error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: String(error) }, { status: 502 });
  }
}
