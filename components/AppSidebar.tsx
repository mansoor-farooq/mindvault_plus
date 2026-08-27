'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { TOOL_CATEGORIES } from '@/lib/toolCategories';
import { Home, Wallet, Store, Settings, LogOut, Sparkles } from 'lucide-react';

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, featureAccess } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const primaryLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/finance', icon: Wallet, label: 'Finance' },
    { href: '/khata', icon: Store, label: 'Khata' },
  ];

  // Same feature-access filtering as the home page's category grid, so the sidebar
  // never links to a tool the admin has disabled/not-yet-granted for this user.
  const visibleCategories = TOOL_CATEGORIES.filter((cat) =>
    cat.tools.some((t) => {
      if (t.showIf && !t.showIf(user)) return false;
      if (t.featureKey && featureAccess && featureAccess[t.featureKey] === false) return false;
      return true;
    })
  );

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
      active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
    }`;

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white border-r border-gray-100 px-4 py-6 gap-1 overflow-y-auto">
      <div className="flex items-center gap-2 px-2 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-indigo-600 to-violet-600">
          <Sparkles className="w-5 h-5" />
        </div>
        <span className="font-black text-lg bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">MindVault</span>
      </div>

      {primaryLinks.map((l) => (
        <Link key={l.href} href={l.href} className={linkClass(pathname === l.href)}>
          <l.icon className="w-4 h-4" /> {l.label}
        </Link>
      ))}

      <div className="mt-4 mb-1 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Tools</div>
      {visibleCategories.map((cat) => (
        <Link key={cat.id} href={`/dashboard/${cat.id}`} className={linkClass(pathname === `/dashboard/${cat.id}`)}>
          <cat.icon className="w-4 h-4" /> {cat.label}
        </Link>
      ))}

      <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-gray-100">
        <Link href="/settings" className={linkClass(pathname === '/settings')}>
          <Settings className="w-4 h-4" /> Settings
        </Link>
        {user && (
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 text-left transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        )}
      </div>
    </aside>
  );
}
