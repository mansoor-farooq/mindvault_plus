"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, LayoutDashboard, Users, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useAdminTheme } from '@/context/AdminThemeContext';

interface SearchItem {
  id: string;
  title: string;
  category: 'Pages' | 'Users';
  href: string;
  icon: React.ElementType;
}

const SEARCH_ITEMS: SearchItem[] = [
  { id: '1', title: 'Dashboard', category: 'Pages', href: '/admin/dashboard', icon: LayoutDashboard },
  { id: '2', title: 'User Management', category: 'Users', href: '/admin/users', icon: Users },
  { id: '3', title: 'Audit Logs', category: 'Pages', href: '/admin/audit-logs', icon: ShieldCheck },
];

export default function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { mode, palette } = useAdminTheme();
  const [query, setQuery] = useState('');

  // Handle hotkey Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredItems = SEARCH_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border transition-all duration-200 ${
          mode === 'dark' ? 'bg-[#161c24] text-gray-100 border-gray-800' : 'bg-white text-gray-900 border-gray-200'
        }`}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, users, products, apps... (Esc to close)"
            className="flex-1 bg-transparent border-none outline-none text-base font-medium placeholder-gray-400"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-medium">No results matching &quot;{query}&quot;</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.href)}
                  className="w-full p-3 rounded-xl flex items-center justify-between group hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg transition-colors group-hover:scale-105"
                      style={{ backgroundColor: palette.primaryLight, color: palette.primary }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-xs text-gray-400">{item.category}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-mono">
              ESC
            </span>
            <span>to close</span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>MindVault Quick Navigator</span>
          </div>
        </div>
      </div>
    </div>
  );
}
