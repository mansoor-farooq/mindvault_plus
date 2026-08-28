// Multi-Tier AI Limits Config
export type PlanTier = 'FREE' | 'PRO' | 'PRO_PLUS' | 'UNLIMITED';

export const AI_TIER_LIMITS: Record<PlanTier, Record<string, number>> = {
  FREE: {
    ai_notes_assist: 5,
    ai_categorize: 5,
    ai_ocr_scans: 2,
    ai_voice_transcribe: 2,
    ai_udhaar_reminder: 3,
    ai_budget_advisor: 1,
    ai_copilot: 1,
  },
  PRO: {
    ai_notes_assist: 100,
    ai_categorize: 200,
    ai_ocr_scans: 50,
    ai_voice_transcribe: 50,
    ai_udhaar_reminder: 30,
    ai_budget_advisor: 20,
    ai_copilot: 50,
  },
  PRO_PLUS: {
    ai_notes_assist: 500,
    ai_categorize: 1000,
    ai_ocr_scans: 250,
    ai_voice_transcribe: 250,
    ai_udhaar_reminder: 150,
    ai_budget_advisor: 100,
    ai_copilot: 250,
  },
  UNLIMITED: {
    ai_notes_assist: Infinity,
    ai_categorize: Infinity,
    ai_ocr_scans: Infinity,
    ai_voice_transcribe: Infinity,
    ai_udhaar_reminder: Infinity,
    ai_budget_advisor: Infinity,
    ai_copilot: Infinity,
  }
};
