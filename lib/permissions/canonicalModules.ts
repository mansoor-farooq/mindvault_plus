/**
 * Canonical Catalog of Module Definitions for Layer 2 User Permission Gate
 * System-defined, strict schema catalog.
 */

export const CANONICAL_MODULES = [
  { key: 'pos', moduleKey: 'pos', displayName: 'Point of Sale & Invoicing', description: 'Counter billing, quotes, and visual receipts', category: 'SALES' },
  { key: 'khata', moduleKey: 'khata', displayName: 'Customer Khata & Udhaar', description: 'Customer credit ledger, settlements, and reminders', category: 'SALES' },
  { key: 'inventory', moduleKey: 'inventory', displayName: 'Inventory & Warehouses', description: 'Multi-location stock, batches, and variants', category: 'OPERATIONS' },
  { key: 'vendors', moduleKey: 'vendors', displayName: 'Vendors & Purchase Orders', description: 'Vendor directory and procurement bills', category: 'OPERATIONS' },
  { key: 'factory', moduleKey: 'factory', displayName: 'Factory BOM & Manufacturing', description: 'Bill of materials and production tracking', category: 'OPERATIONS' },
  { key: 'payroll', moduleKey: 'payroll', displayName: 'Staff & Payroll Management', description: 'Staff roster, salaries, and advances', category: 'HR' },
  { key: 'team_management', moduleKey: 'team_management', displayName: 'Team & Staff Roles Management', description: 'Staff invitations and role assignment', category: 'HR' },
  { key: 'roznamcha', moduleKey: 'roznamcha', displayName: 'Finance, Wallets & Expenses', description: 'Daily cash book, bank wallets, and expense logs', category: 'FINANCE' },
  { key: 'budget', moduleKey: 'budget', displayName: 'Budgets & Gulluck Savings', description: 'Monthly targets, digital kameti, and savings jars', category: 'FINANCE' },
  { key: 'reports', moduleKey: 'reports', displayName: 'Master Reports & P&L Analytics', description: 'Financial statements, sales analytics, and audit exports', category: 'EXECUTIVE' },
  { key: 'service_tracker', moduleKey: 'service_tracker', displayName: 'Rozana Periodic Service Tracker', description: 'Daily distribution logs, customer subscriptions, and invoices', category: 'OPERATIONS' },
  { key: 'notes_ai', moduleKey: 'notes_ai', displayName: 'AI Notes & Document Scanner', description: 'Smart notes, OCR scanning, and voice transcription', category: 'TOOLS' },
  { key: 'tools', moduleKey: 'tools', displayName: 'Calculators, Tasks & Games', description: 'Business calculators, daily tasks, and educational tools', category: 'TOOLS' },
] as const;

export type ModuleKey = typeof CANONICAL_MODULES[number]['moduleKey'];
export type CanonicalModuleKey = ModuleKey;
export type AccessLevel = 'none' | 'view' | 'full';

export const VALID_MODULE_KEYS = new Set<string>(CANONICAL_MODULES.map(m => m.moduleKey));
export const VALID_ACCESS_LEVELS = new Set<string>(['none', 'view', 'full']);

export function isValidModuleKey(key: string): key is ModuleKey {
  return VALID_MODULE_KEYS.has(key);
}

export function isValidAccessLevel(level: string): level is AccessLevel {
  return VALID_ACCESS_LEVELS.has(level);
}

/**
 * Access level comparator: 'full' >= 'view' > 'none'.
 */
export function isAccessSufficient(userLevel: AccessLevel, requiredLevel: AccessLevel): boolean {
  if (requiredLevel === 'none') return true;
  if (requiredLevel === 'view') {
    return userLevel === 'view' || userLevel === 'full';
  }
  if (requiredLevel === 'full') {
    return userLevel === 'full';
  }
  return false;
}
