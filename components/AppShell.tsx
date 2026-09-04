'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import AppSidebar from './AppSidebar';
import { Menu, Sparkles, Bell } from 'lucide-react';
import AICopilot from './AICopilot';

const EXCLUDED_PREFIXES = ['/admin', '/login', '/register', '/lock'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore(s => s.user);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState([
    { id: 1, type: 'system', title: 'System Updated', desc: 'MindVault ERP has been updated with Task Manager & Live Sale Radar features.', time: 'Just now' },
    { id: 2, type: 'alert', title: 'Pending Tasks', desc: 'You have uncompleted tasks pending in your Task Manager.', time: '2 hours ago' }
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isExcluded = EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isExcluded) {
    return <>{children}</>;
  }

  const markAllRead = () => setNotifications([]);
  const removeNotif = (id: number) => setNotifications(prev => prev.filter(n => n.id !== id));

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
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 z-50">
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
          
          <div className="flex items-center gap-4 relative">
            
            <div ref={notifRef} className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800">Notifications</h3>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} className="text-xs text-indigo-600 font-bold hover:underline">Mark all as read</button>
                    )}
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">
                        You have no new notifications.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} onClick={() => removeNotif(n.id)} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.type === 'system' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                            {n.type === 'system' ? <Sparkles className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-bold">{n.time}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div 
                    onClick={() => setShowNotifications(false)} 
                    className="p-3 bg-slate-50 border-t border-slate-100 text-center hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <button className="text-xs font-bold text-slate-500">View All Activity</button>
                  </div>
                </div>
              )}
            </div>

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


