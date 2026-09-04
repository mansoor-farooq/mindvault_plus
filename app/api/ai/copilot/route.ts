import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/services/geminiClient';
import { requireModuleAccess } from '@/lib/auth/moduleGate';

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'tools', 'view');
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const { prompt } = body;

    const fullPrompt = `You are the MindVault AI Copilot, a highly intelligent and polite business assistant integrated into a Next.js ERP software (built for the Pakistani market). 
Your user is a factory/shop owner. Keep your responses short, professional, and helpful. 
User asked: "${prompt}"`;

    const response = await generateText(fullPrompt);
    
    return NextResponse.json({ reply: response });
  } catch (error: any) {
    console.error('Copilot API Error:', error);
    return NextResponse.json({ reply: 'Sorry, I am facing an issue connecting to the AI models right now.' }, { status: 500 });
  }
}
