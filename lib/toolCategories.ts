import { LucideIcon, Package, Sparkles, Calculator, LayoutGrid, Boxes, FolderTree, MapPin, BarChart3, MessageCircleQuestion, Gamepad2, Moon, HardDrive, Trash2, Mail, PieChart, Target, Radar, Users, Briefcase, UserCheck, Receipt, Presentation, PiggyBank, FileText, Truck } from 'lucide-react';
import { User } from './db';

export interface ToolCategoryItem {
  href: string;
  icon: LucideIcon;
  label: string;
  showIf?: (user: User | null) => boolean;
  // Key into FEATURE_ACCESS_CATALOG (lib/featureAccess.ts). Tools without a featureKey
  // (e.g. "Backup", "Recycle Bin") are never gated - only entries that map onto a real
  // toggleable feature are hidden when disabled.
  featureKey?: string;
}

export interface ToolCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  // Full literal Tailwind classes (e.g. "text-cyan-600 bg-cyan-50") - kept literal rather
  // than built from a color-name prefix so Tailwind's static class scanner can find them.
  colorClass: string;
}

// Static app-level navigation grouping - NOT related to the user-editable inventory
// Category entity (lib/db.ts's Category interface). This just organizes the app's own
// feature list for the home screen and category dashboard pages.
export const TOOL_CATEGORIES: (ToolCategory & { tools: ToolCategoryItem[] })[] = [
  {
    id: 'erp-system',
    label: 'ERP & Billing',
    icon: Presentation,
    colorClass: 'text-violet-600 bg-violet-50',
    tools: [
      { href: '/erp', icon: Receipt, label: 'POS & Analytics' },
      { href: '/vendors', icon: Truck, label: 'Suppliers & Purchases' },
      { href: '/quotes', icon: FileText, label: 'Quotation Builder' },
    ],
  },
  {
    id: 'factory-hr',
    label: 'Factory & Staff',
    icon: Briefcase,
    colorClass: 'text-indigo-600 bg-indigo-50',
    tools: [
      { href: '/staff', icon: UserCheck, label: 'Staff & Peshgi' },
    ],
  },
    ],
  },
  {
    id: 'budget-planner',
    label: 'Budget & Planner',
    icon: PieChart,
    colorClass: 'text-emerald-600 bg-emerald-50',
    tools: [
      { href: '/budget', icon: Target, label: 'Monthly Budgets' },
      { href: '/gulluck', icon: PiggyBank, label: 'Gulluck (Savings)' },
      { href: '/sale-alerts', icon: Radar, label: 'Sale Radar' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Stock',
    icon: Package,
    colorClass: 'text-cyan-600 bg-cyan-50',
    tools: [
      { href: '/inventory', icon: Boxes, label: 'Inventory', featureKey: 'inventory' },
      { href: '/categories', icon: FolderTree, label: 'Categories', featureKey: 'categories' },
      { href: '/locations', icon: MapPin, label: 'Locations', featureKey: 'locations' },
      { href: '/analytics', icon: BarChart3, label: 'Analytics', featureKey: 'analytics' },
    ],
  },
  {
    id: 'notes-ai',
    label: 'Notes & AI',
    icon: Sparkles,
    colorClass: 'text-purple-600 bg-purple-50',
    tools: [
      { href: '/notes/ask', icon: MessageCircleQuestion, label: 'Ask MindVault', featureKey: 'notes_ai' },
      { href: '/notes/voice-email', icon: Mail, label: 'Voice to Email', featureKey: 'voice_email' },
    ],
  },
  {
    id: 'money-tools',
    label: 'Money Tools',
    icon: Calculator,
    colorClass: 'text-amber-600 bg-amber-50',
    tools: [
      { href: '/kameti', icon: Users, label: 'Kameti Manager' },
      { href: '/tools', icon: Calculator, label: 'Calculators', featureKey: 'calculators' },
      { href: '/games', icon: Gamepad2, label: 'Money Quiz', featureKey: 'money_quiz' },
    ],
  },
  {
    id: 'more',
    label: 'More',
    icon: LayoutGrid,
    colorClass: 'text-gray-600 bg-gray-100',
    tools: [
      { href: '/prayer-times', icon: Moon, label: 'Prayer Times', showIf: (user) => user?.religion === 'muslim' },
      { href: '/settings', icon: HardDrive, label: 'Backup', featureKey: 'drive_backup' },
      { href: '/trash', icon: Trash2, label: 'Recycle Bin' },
    ],
  },
];

export function getToolCategory(id: string) {
  return TOOL_CATEGORIES.find((c) => c.id === id);
}










