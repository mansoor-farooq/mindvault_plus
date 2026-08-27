// Canonical catalog of toggleable app features, keyed the same way lib/toolCategories.ts's
// tools are grouped. Kept as a separate flat list (rather than deriving from
// TOOL_CATEGORIES) because not every entry here maps 1:1 to a single nav tool (e.g.
// 'khata'/'finance' are whole feature areas, not single tool-strip entries).
export interface FeatureCatalogEntry {
  key: string;
  label: string;
  vip: boolean; // VIP features default to disabled until an admin explicitly grants them
}

export const FEATURE_ACCESS_CATALOG: FeatureCatalogEntry[] = [
  { key: 'inventory', label: 'Inventory', vip: false },
  { key: 'categories', label: 'Categories', vip: false },
  { key: 'locations', label: 'Locations', vip: false },
  { key: 'analytics', label: 'Analytics', vip: true },
  { key: 'notes_ai', label: 'Ask MindVault', vip: true },
  // Deliberately separate from 'notes_ai' - text chat can still be reached by a FREE
  // user an admin has granted 'notes_ai' to, boosted by watching ads for extra daily
  // quota. Voice messaging must never be reachable that way - it's gated purely on
  // real paid status (or an explicit admin grant of THIS key), with no ad-quota path
  // at all, since requireFeatureAccess has no ad-bypass mechanism to begin with.
  { key: 'notes_voice_chat', label: 'Voice Chat with AI', vip: true },
  // Same strict "paid/admin-grant only, no ad-bypass" treatment as notes_voice_chat -
  // every voice-input AI feature in this app follows that rule.
  { key: 'voice_email', label: 'Voice to Email', vip: true },
  { key: 'calculators', label: 'Calculators', vip: false },
  { key: 'money_quiz', label: 'Money Quiz', vip: false },
  { key: 'khata', label: 'Khata', vip: false },
  { key: 'finance', label: 'Finance', vip: false },
  { key: 'drive_backup', label: 'Google Drive Backup', vip: true },
];

export function getFeatureCatalogEntry(key: string): FeatureCatalogEntry | undefined {
  return FEATURE_ACCESS_CATALOG.find((f) => f.key === key);
}
