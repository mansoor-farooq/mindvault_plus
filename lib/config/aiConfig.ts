// Daily call limits for FREE-tier users. PRO/LIFETIME bypass entirely
// (see gatingService.checkAndConsumeDailyQuota). Kept separate from
// gatingConfig.ts's FREE_LIMITS since those are row-count limits, not
// daily-call-count limits.
export const AI_FREE_LIMITS: Record<string, number> = {
  ai_notes_assist: 10,
  ai_categorize: 20,
  ai_ocr_scans: 5,
  ai_voice_transcribe: 5,
  ai_udhaar_reminder: 3,
  ai_budget_advisor: 2,
};

