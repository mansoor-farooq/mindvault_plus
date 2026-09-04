'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getTerm } from '@/lib/terminology';
import { 
  Home, Wallet, Store, Settings, LogOut, Sparkles, LineChart, Factory, 
  Presentation, Briefcase, Calculator, Users, PieChart, Package, Radar, PiggyBank, FileText, Truck, LayoutGrid, ClipboardList, Mail,
  BarChart3, FolderTree, MapPin, Trophy, Calendar
} from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import { CanonicalModuleKey } from '@/lib/permissions/canonicalModules';

interface NavLinkItem {
  href: string;
  icon: any;
  label: string;
  module?: CanonicalModuleKey;
  feature?: string;
}

export default function AppSidebar({ isMobile = false, onClose }: { isMobile?: boolean, onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, featureAccess } = useAuthStore();
  const { isOwner, canView, roleName } = usePermissions();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Check both Layer 1 (featureAccess) and Layer 2 (canView module)
  const canAccess = (item: NavLinkItem) => {
    if (item.module && !canView(item.module)) {
      return false;
    }
    if (item.feature && featureAccess) {
      return featureAccess[item.feature] !== false;
    }
    return true;
  };

  const overviewLinks: NavLinkItem[] = [
    { href: '/', icon: Home, label: getTerm(user, 'dashboard') },
    { href: '/pnl', icon: LineChart, label: 'Profit & Loss (P&L)', module: 'reports' },
    { href: '/reports', icon: FileText, label: 'Master Reports', module: 'reports' },
    { href: '/analytics', icon: BarChart3, label: 'Area & Sales Analytics', feature: 'analytics', module: 'reports' },
  ];

  const businessLinks: NavLinkItem[] = [
    { href: '/erp', icon: Presentation, label: getTerm(user, 'pos'), module: 'pos' },
    { href: '/quotes', icon: FileText, label: 'Quotation / Estimate', module: 'pos' },
    { href: '/services', icon: Calendar, label: 'Rozana Service Tracker', module: 'service_tracker' },
    { href: '/invoice-builder', icon: LayoutGrid, label: 'Visual PDF Builder', module: 'pos' },
    { href: '/vendors', icon: Truck, label: getTerm(user, 'vendors'), module: 'vendors' },
    { href: '/khata', icon: Store, label: getTerm(user, 'customers'), feature: 'khata', module: 'khata' },
    { href: '/inventory', icon: Package, label: getTerm(user, 'inventory'), feature: 'inventory', module: 'inventory' },
    { href: '/categories', icon: FolderTree, label: 'Categories', feature: 'categories', module: 'inventory' },
    { href: '/locations', icon: MapPin, label: 'Locations & Branches', feature: 'locations', module: 'inventory' },
    { href: '/factory', icon: Factory, label: getTerm(user, 'production'), module: 'factory' },
  ];

  const financeLinks: NavLinkItem[] = [
    { href: '/staff', icon: Briefcase, label: getTerm(user, 'staff'), module: 'payroll' },
    { href: '/budget', icon: PieChart, label: 'Budgets', module: 'budget' },
    { href: '/gulluck', icon: PiggyBank, label: 'Gulluck (Savings)', module: 'budget' },
    { href: '/kameti', icon: Users, label: 'Digital Kameti', module: 'budget' },
  ];

  const toolLinks: NavLinkItem[] = [
    { href: '/tools', icon: Calculator, label: 'Calculators & Tools', feature: 'calculators', module: 'tools' },
    { href: '/tasks', icon: ClipboardList, label: 'Task Manager', module: 'tools' },
    { href: '/sale-alerts', icon: Radar, label: 'Sale Radar', module: 'tools' },
    { href: '/finance', icon: Wallet, label: getTerm(user, 'finance'), feature: 'finance', module: 'roznamcha' },
    { href: '/notes/document', icon: Sparkles, label: 'AI Notes', feature: 'notes_ai', module: 'notes_ai' },
    { href: '/games', icon: Trophy, label: 'MindCoins & Quiz', feature: 'money_quiz', module: 'tools' },
  ];

  const filteredOverview = overviewLinks.filter(canAccess);
  const filteredBusiness = businessLinks.filter(canAccess);
  const filteredFinance = financeLinks.filter(canAccess);
  const filteredTools = toolLinks.filter(canAccess);

  const navGroups = [
    filteredOverview.length > 0 && {
      title: 'OVERVIEW',
      links: filteredOverview,
    },
    filteredBusiness.length > 0 && {
      title: 'BUSINESS & SALES',
      links: filteredBusiness,
    },
    filteredFinance.length > 0 && {
      title: 'FINANCE & HR',
      links: filteredFinance,
    },
    filteredTools.length > 0 && {
      title: 'TOOLS & AI',
      links: filteredTools,
    },
  ].filter(Boolean) as { title: string; links: NavLinkItem[] }[];

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
      active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <aside className={`flex flex-col h-full bg-white border-r border-slate-200 w-72 shrink-0 ${isMobile ? '' : 'hidden lg:flex'}`}>
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-6 shrink-0 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <Sparkles className="w-5 h-5" />
        </div>
        <span className="font-black text-xl text-slate-800 tracking-tight">MindVault<span className="text-indigo-600">.</span></span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-8">
        {navGroups.map((group, i) => (
          <div key={i} className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">{group.title}</span>
            {group.links.map((link: any) => (
              <Link 
                key={link.href} 
                href={link.href} 
                onClick={onClose}
                className={linkClass(pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/'))}
              >
                <link.icon className={`w-5 h-5 ${pathname === link.href ? 'text-indigo-200' : 'text-slate-400'}`} /> 
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Footer Settings */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-1">
        <div className="px-3 py-1.5 mb-1 flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-700 truncate max-w-[120px]">{user?.fullName || user?.email}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
            {roleName}
          </span>
        </div>
        {user?.license === 'FREE' && isOwner && (
          <Link href="/upgrade" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors mb-2">
            <Sparkles className="w-5 h-5" /> Upgrade to PRO
          </Link>
        )}
        {(isOwner || canView('team_management')) && (
          <Link href="/settings" onClick={onClose} className={linkClass(pathname === '/settings' || pathname.startsWith('/settings/'))}>
            <Settings className="w-5 h-5 text-slate-400" /> Settings
          </Link>
        )}
        <Link href="/contact" onClick={onClose} className={linkClass(pathname === '/contact')}>
          <Mail className="w-5 h-5 text-slate-400" /> Contact Support
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 text-left transition-colors">
          <LogOut className="w-5 h-5 opacity-70" /> Logout
        </button>
      </div>
    </aside>
  );
}




