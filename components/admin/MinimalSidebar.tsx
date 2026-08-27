"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  History,
  ChevronDown,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { useAdminSession } from '@/context/AdminSessionContext';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  subItems?: { title: string; href: string }[];
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: 'OVERVIEW',
    items: [
      { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    groupTitle: 'MANAGEMENT',
    items: [
      { title: 'User Management', href: '/admin/users', icon: Users },
    ],
  },
  {
    groupTitle: 'SYSTEM & SECURITY',
    items: [
      { title: 'Audit Logs', href: '/admin/audit-logs', icon: History },
    ],
  },
];

export default function MinimalSidebar() {
  const pathname = usePathname();
  const { mode, sidebarMode, palette } = useAdminTheme();
  const { me } = useAdminSession();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const isMini = sidebarMode === 'mini';

  const toggleSubmenu = (title: string) => {
    setOpenSubmenu(openSubmenu === title ? null : title);
  };

  return (
    <aside
      className={`sticky top-0 h-screen z-40 border-r flex flex-col transition-all duration-300 ${
        isMini ? 'w-20' : 'w-72'
      } ${
        mode === 'dark'
          ? 'bg-[#161c24] border-gray-800 text-gray-100'
          : 'bg-white border-gray-200 text-gray-900'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
        <Link href="/admin/dashboard" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg transition-transform group-hover:scale-105"
            style={{ background: palette.accentGradient }}
          >
            M
          </div>
          {!isMini && (
            <div>
              <span className="font-extrabold text-lg tracking-tight flex items-center gap-1.5">
                MindVault
              </span>
              <p className="text-[10px] text-gray-400 font-medium">Admin Panel</p>
            </div>
          )}
        </Link>
      </div>

      {/* User Quick Info Banner */}
      {!isMini && (
        <div className="mx-4 my-4 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow"
            style={{ background: palette.accentGradient }}
          >
            {(me?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold truncate">{me?.name || 'Admin'}</h4>
            <p className="text-[11px] text-gray-400 truncate">
              {me?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
            </p>
          </div>
          {me?.role === 'SUPER_ADMIN' && <ShieldCheck className="w-4 h-4 text-amber-500" />}
        </div>
      )}

      {/* Nav List Container */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupTitle} className="space-y-1">
            {!isMini && (
              <h5 className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 py-1.5">
                {group.groupTitle}
              </h5>
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isActive =
                pathname === item.href ||
                (hasSubItems && item.subItems?.some((sub) => pathname === sub.href));
              const isSubOpen = openSubmenu === item.title;

              return (
                <div key={item.title}>
                  {hasSubItems ? (
                    <div>
                      <button
                        onClick={() => toggleSubmenu(item.title)}
                        className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-all text-xs font-semibold ${
                          isActive
                            ? 'font-bold'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                        }`}
                        style={{
                          backgroundColor: isActive ? palette.primaryLight : undefined,
                          color: isActive ? palette.primary : undefined,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          {!isMini && <span>{item.title}</span>}
                        </div>
                        {!isMini && (
                          <div className="flex items-center gap-2">
                            {item.badge && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-black text-white"
                                style={{ background: palette.primary }}
                              >
                                {item.badge}
                              </span>
                            )}
                            {isSubOpen ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        )}
                      </button>

                      {/* Submenu Dropdown */}
                      {!isMini && isSubOpen && (
                        <div className="ml-5 mt-1 pl-3 border-l border-gray-200 dark:border-gray-800 space-y-1">
                          {item.subItems?.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.title}
                                href={sub.href}
                                className={`block px-3 py-2 rounded-lg text-xs transition-colors ${
                                  isSubActive
                                    ? 'font-bold'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                                style={{
                                  color: isSubActive ? palette.primary : undefined,
                                }}
                              >
                                {sub.title}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={`px-3 py-2.5 rounded-xl flex items-center justify-between transition-all text-xs font-semibold ${
                        isActive
                          ? 'font-bold shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                      }`}
                      style={{
                        backgroundColor: isActive ? palette.primaryLight : undefined,
                        color: isActive ? palette.primary : undefined,
                      }}
                      title={isMini ? item.title : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {!isMini && <span>{item.title}</span>}
                      </div>
                      {!isMini && item.badge && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-black text-white"
                          style={{ background: palette.primary }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      {!isMini && (
        <div className="px-6 py-4 text-center border-t border-gray-100 dark:border-gray-800/60">
          <p className="text-[10px] text-gray-400 font-medium">MindVault Admin &middot; v1.0</p>
        </div>
      )}
    </aside>
  );
}
