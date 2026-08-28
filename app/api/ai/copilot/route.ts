import { NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/services/geminiClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    const gemini = getGeminiClient();
    
    // System prompt giving the AI context about its role as the ERP assistant
    const fullPrompt = \
    You are the MindVault AI Copilot, a highly intelligent and polite business assistant integrated into a Next.js ERP software (built for the Pakistani market). 
    Your user is a factory/shop owner. Keep your responses short, professional, and helpful. 
    User asked: "\"
    \;

    const response = await gemini.generateContent(fullPrompt);
    
    return NextResponse.json({ reply: response });
  } catch (error: any) {
    console.error('Copilot API Error:', error);
    return NextResponse.json({ reply: 'Sorry, I am facing an issue connecting to the AI models right now.' }, { status: 500 });
  }
}
