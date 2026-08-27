export const FREE_LIMITS: Record<string, number> = {
  khata_customers: 10,
  products: 25,
};

export const DAILY_AD_UNLOCK_LIMIT = 3; // Max 3 rewarded ad watches per feature per day
export const AD_BONUS_REWARD = 5;       // Watching 1 ad unlocks +5 customer slots or +5 product slots
export const AD_NONCE_EXPIRY_MS = 1000 * 60 * 15; // 15 minutes expiry for the signed nonce
