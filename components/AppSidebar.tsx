'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { 
  Home, Wallet, Store, Settings, LogOut, Sparkles, 
  Presentation, Briefcase, Calculator, Users, PieChart, Package, Radar, PiggyBank, FileText, Truck, LayoutGrid
} from 'lucide-react';

export default function AppSidebar({ isMobile = false, onClose }: { isMobile?: boolean, onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isCashier = user?.role === 'CASHIER';
  const isManager = user?.role === 'MANAGER';
  const hasFullAccess = user?.role === 'ADMIN' || user?.role === 'OWNER' || !user?.role;

  const navGroups = [
    !isCashier && {
      title: 'OVERVIEW',
      links: [
        { href: '/', icon: Home, label: 'Dashboard' },
        { href: '/reports', icon: FileText, label: 'Master Reports' },
      ]
    },
    {
      title: 'BUSINESS & SALES',
      links: [
        { href: '/erp', icon: Presentation, label: 'ERP & Billing (POS)' },
        { href: '/quotes', icon: FileText, label: 'Quotation / Estimate' },
        { href: '/invoice-builder', icon: LayoutGrid, label: 'Visual PDF Builder' },
        !isCashier && { href: '/vendors', icon: Truck, label: 'Suppliers (Purchases)' },
        { href: '/khata', icon: Store, label: 'Customer Khata' },
        { href: '/inventory', icon: Package, label: 'Inventory' },
      ].filter(Boolean)
    },
    !isCashier && {
      title: 'FINANCE & HR',
      links: [
        { href: '/staff', icon: Briefcase, label: 'Factory Staff' },
        { href: '/budget', icon: PieChart, label: 'Budgets' },
        { href: '/gulluck', icon: PiggyBank, label: 'Gulluck (Savings)' },
        { href: '/kameti', icon: Users, label: 'Digital Kameti' },
      ]
    },
    hasFullAccess && {
      title: 'TOOLS',
      links: [
        { href: '/sale-alerts', icon: Radar, label: 'Sale Radar' },
        { href: '/finance', icon: Wallet, label: 'Cash Ledger' },
        { href: '/notes/document', icon: Calculator, label: 'AI Notes' },
      ]
    }
  ].filter(Boolean) as any[];

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
        {hasFullAccess && (
          <Link href="/settings" onClick={onClose} className={linkClass(pathname === '/settings')}>
            <Settings className="w-5 h-5 text-slate-400" /> Settings
          </Link>
        )}
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 text-left transition-colors">
          <LogOut className="w-5 h-5 opacity-70" /> Logout
        </button>
      </div>
    </aside>
  );
}

