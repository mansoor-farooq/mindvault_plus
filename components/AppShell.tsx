'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';
import { Menu, Sparkles, Bell } from 'lucide-react';
import AICopilot from './AICopilot';

const EXCLUDED_PREFIXES = ['/admin', '/login', '/register', '/lock'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore(s => s.user);
  const isExcluded = EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isExcluded) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <AppSidebar />

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col">
            <AppSidebar isMobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Unified Topbar (Visible on both Mobile and Desktop) */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl">
              <Menu className="w-6 h-6" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800">MindVault</span>
            </div>
            
            {/* Desktop Breadcrumb/Title placeholder */}
            <div className="hidden lg:flex items-center text-sm font-medium text-slate-500">
              <span className="text-indigo-600">Workspace</span>
              <span className="mx-2">/</span>
              <span className="text-slate-800 capitalize">{pathname === '/' ? 'Dashboard' : pathname.replace('/', '')}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
            </button>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-tight">{user?.fullName || 'Admin'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{user?.role || 'OWNER'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-sm shadow-sm">
                {(user?.fullName || 'AD').substring(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50">
          {children}
        </div>
        <AICopilot />
      </div>
    </div>
  );
}


