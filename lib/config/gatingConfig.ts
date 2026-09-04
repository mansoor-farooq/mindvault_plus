export const FREE_LIMITS: Record<string, number> = {
  khata_customers: 25,
  products: 50,
};

export const STARTER_LIMITS: Record<string, number> = {
  khata_customers: 500,
  products: 1000,
};

export const PRO_LIMITS: Record<string, number> = {
  khata_customers: 5000,
  products: 10000,
};

// Factory Module Tier Segmentation (Option A: Approved)
export const PRO_FACTORY_LIMITS = {
  maxWorkCenters: 2,
  maxMonthlyWorkOrders: 10,
  allowMultiLevelBOM: false,
  allowLiveOEE: false,
  allowLotSerialTracking: false,
};

export const ULTRA_FACTORY_LIMITS = {
  maxWorkCenters: Infinity,
  maxMonthlyWorkOrders: Infinity,
  allowMultiLevelBOM: true,
  allowLiveOEE: true,
  allowLotSerialTracking: true,
};

export function getFactoryTierCapabilities(licenseType: string = 'FREE') {
  const isUltraOrAbove = ['ULTRA', 'PRO_PLUS', 'LIFETIME', 'UNLIMITED'].includes(licenseType.toUpperCase());
  if (isUltraOrAbove) {
    return ULTRA_FACTORY_LIMITS;
  }
  return PRO_FACTORY_LIMITS;
}

export const DAILY_AD_UNLOCK_LIMIT = 3; // Max 3 rewarded ad watches per feature per day
export const AD_BONUS_REWARD = 5;       // Watching 1 ad unlocks +5 customer slots or +5 product slots
export const AD_NONCE_EXPIRY_MS = 1000 * 60 * 15; // 15 minutes expiry for the signed nonce
