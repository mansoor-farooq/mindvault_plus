import { LucideIcon, Package, Sparkles, Calculator, LayoutGrid, Boxes, FolderTree, MapPin, BarChart3, MessageCircleQuestion, Gamepad2, Moon, HardDrive, Trash2, Mail, PieChart, Target, Radar, Users, Briefcase, UserCheck, Receipt, Presentation, PiggyBank, FileText, Truck, Store, Wallet, Mic } from 'lucide-react';
import { User } from './db';

export interface ToolCategoryItem {
  href: string;
  icon: LucideIcon;
  label: string;
  showIf?: (user: User | null) => boolean;
  featureKey?: string; 
}

export interface ToolCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  colorClass: string;
}

export const TOOL_CATEGORIES: (ToolCategory & { tools: ToolCategoryItem[] })[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: LayoutGrid,
    colorClass: 'text-indigo-600 bg-indigo-50',
    tools: [
      { href: '/', icon: LayoutGrid, label: 'Main Dashboard' },
      { href: '/reports', icon: FileText, label: 'Master Reports', featureKey: 'module_reports' },
    ],
  },
  {
    id: 'erp-system',
    label: 'ERP & Billing',
    icon: Presentation,
    colorClass: 'text-violet-600 bg-violet-50',
    tools: [
      { href: '/erp', icon: Receipt, label: 'POS & Analytics', featureKey: 'module_pos' },
      { href: '/quotes', icon: FileText, label: 'Quotation Builder', featureKey: 'module_quotes' },
      { href: '/invoice-builder', icon: LayoutGrid, label: 'Visual PDF Builder', featureKey: 'module_invoice_builder' },
      { href: '/vendors', icon: Truck, label: 'Suppliers & Purchases', featureKey: 'module_vendors' },
    ],
  },
  {
    id: 'finance-app',
    label: 'Money Tools',
    icon: Calculator,
    colorClass: 'text-blue-600 bg-blue-50',
    tools: [
      { href: '/khata', icon: Store, label: 'Customer Khata', featureKey: 'module_khata' },
      { href: '/finance', icon: Wallet, label: 'Cash Ledger', featureKey: 'module_ledger' },
      { href: '/inventory', icon: Package, label: 'Inventory', featureKey: 'module_inventory' },
    ],
  },
  {
    id: 'budget-planner',
    label: 'Budget & Planner',
    icon: PieChart,
    colorClass: 'text-emerald-600 bg-emerald-50',
    tools: [
      { href: '/budget', icon: Target, label: 'Monthly Budgets', featureKey: 'module_budget' },
      { href: '/gulluck', icon: PiggyBank, label: 'Gulluck (Savings)', featureKey: 'module_gulluck' },
      { href: '/sale-alerts', icon: Radar, label: 'Sale Radar', featureKey: 'module_radar' },
    ],
  },
  {
    id: 'factory-staff',
    label: 'Factory & Staff',
    icon: Briefcase,
    colorClass: 'text-indigo-600 bg-indigo-50',
    tools: [
      { href: '/staff', icon: Briefcase, label: 'Staff & Peshgi', featureKey: 'module_hr' },
      { href: '/kameti', icon: Users, label: 'Digital Kameti', featureKey: 'module_kameti' },
    ],
  },
  {
    id: 'ai-tools',
    label: 'AI & Productivity',
    icon: Sparkles,
    colorClass: 'text-rose-600 bg-rose-50',
    tools: [
      { href: '/notes/voice', icon: Mic, label: 'Voice Notes', featureKey: 'module_voice' },
      { href: '/notes/document', icon: FileText, label: 'AI Notes', featureKey: 'module_notes' },
    ],
  }
];

