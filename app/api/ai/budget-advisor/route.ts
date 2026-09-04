import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/services/geminiClient';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { enforceQuota } from '@/lib/services/aiHelpers';

export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'budget', 'view');
  if (!gate.ok) return gate.response;

  const quotaError = await enforceQuota(gate.businessId, 'ai_budget_advisor');
  if (quotaError) return quotaError;

  try {
    const { budgets, expenses, month } = await req.json();

    const prompt = `You are an expert financial advisor for the user. 
Analyze their spending for the month of ${month}.
Here are their budget limits: ${JSON.stringify(budgets)}
Here is what they have spent so far: ${JSON.stringify(expenses)}

Provide a concise, motivating, and highly actionable piece of advice (3-4 sentences max) telling them how they are doing and where they should slow down or re-allocate to "manage the month bestly". Focus on categories like Grocery, Shopping, Fuel, and Investments.`;

    const advice = await generateText(prompt);

    return NextResponse.json({ advice: advice.trim() });
  } catch (error) {
    console.error('Budget advisor error:', error);
    return NextResponse.json({ error: 'AI_UNAVAILABLE', message: String(error) }, { status: 502 });
  }
}
