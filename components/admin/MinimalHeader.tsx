"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Sun,
  Moon,
  Bell,
  Check,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Globe,
  ShoppingBag,
  MessageSquare,
  AlertCircle,
  X,
  ExternalLink
} from 'lucide-react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { useAdminSession } from '@/context/AdminSessionContext';
import GlobalSearchModal from './GlobalSearchModal';

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'order' | 'message' | 'system';
}

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'New order received #ORD-9482',
    description: 'You have a new order for iPhone 15 Pro Max',
    time: '5 min ago',
    read: false,
    type: 'order',
  },
  {
    id: '2',
    title: 'New message from Sarah Jenkins',
    description: 'Can we schedule a call regarding the UI design updates?',
    time: '45 min ago',
    read: false,
    type: 'message',
  },
  {
    id: '3',
    title: 'System Backup Completed',
    description: 'Automated nightly database backup completed cleanly',
    time: '2 hours ago',
    read: true,
    type: 'system',
  },
  {
    id: '4',
    title: 'Monthly Sales Milestone Reached!',
    description: 'Revenue exceeded $50,000 threshold for August 2026',
    time: '5 hours ago',
    read: true,
    type: 'system',
  },
];

export default function MinimalHeader() {
  const router = useRouter();
  const { mode, toggleMode, toggleSidebarMode, palette } = useAdminTheme();
  const { me, logout } = useAdminSession();
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  // No real notification system is wired up yet - start empty rather than
  // showing SAMPLE_NOTIFICATIONS mock data as if it were real activity.
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filteredNotifications = notifications.filter((n) =>
    notificationTab === 'unread' ? !n.read : true
  );

  return (
    <>
      <header
        className={`sticky top-0 z-30 h-16 px-4 md:px-8 border-b backdrop-blur-md transition-colors flex items-center justify-between ${
          mode === 'dark'
            ? 'bg-[#161c24]/80 border-gray-800 text-gray-100'
            : 'bg-white/80 border-gray-200 text-gray-900'
        }`}
      >
        {/* Left Side: Mobile Menu & Search */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebarMode}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Quick Search Bar */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 transition-all text-xs font-medium min-w-[220px]"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-mono text-gray-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center gap-1.5 transition-colors text-xs font-semibold"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden md:inline">{selectedLang}</span>
            </button>
            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-xl shadow-xl border bg-white dark:bg-[#161c24] border-gray-200 dark:border-gray-800 py-1.5 z-40 text-xs">
                {['English', 'Spanish', 'French', 'Urdu', 'German'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setSelectedLang(lang);
                      setIsLangOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      selectedLang === lang ? 'font-bold text-primary' : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <span>{lang}</span>
                    {selectedLang === lang && <Check className="w-3.5 h-3.5" style={{ color: palette.primary }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleMode}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {mode === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600" />
            )}
          </button>

          {/* Notifications Drawer Toggle */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popover Drawer */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border bg-white dark:bg-[#161c24] border-gray-200 dark:border-gray-800 overflow-hidden z-40">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">Notifications</h3>
                    <p className="text-xs text-gray-400">You have {unreadCount} unread messages</p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: palette.primary }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification Tabs */}
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex gap-4 text-xs font-semibold">
                  <button
                    onClick={() => setNotificationTab('all')}
                    className={`pb-1 border-b-2 transition-colors ${
                      notificationTab === 'all'
                        ? 'border-primary font-bold'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                    style={{ borderColor: notificationTab === 'all' ? palette.primary : 'transparent' }}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotificationTab('unread')}
                    className={`pb-1 border-b-2 transition-colors ${
                      notificationTab === 'unread'
                        ? 'border-primary font-bold'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                    style={{ borderColor: notificationTab === 'unread' ? palette.primary : 'transparent' }}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredNotifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      No notifications to display
                    </div>
                  ) : (
                    filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3.5 flex items-start gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                          !notification.read ? 'bg-primary-light/30' : ''
                        }`}
                      >
                        <div
                          className="p-2 rounded-xl flex-shrink-0"
                          style={{ backgroundColor: palette.primaryLight, color: palette.primary }}
                        >
                          {notification.type === 'order' ? (
                            <ShoppingBag className="w-4 h-4" />
                          ) : notification.type === 'message' ? (
                            <MessageSquare className="w-4 h-4" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold truncate">{notification.title}</h4>
                          <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">
                            {notification.description}
                          </p>
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            {notification.time}
                          </span>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 border-t border-gray-200 dark:border-gray-800 text-center bg-gray-50/50 dark:bg-gray-900/50">
                  <button
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  >
                    View All Activity
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="p-1 rounded-full hover:ring-2 ring-primary transition-all flex items-center gap-2"
            >
              <div
                className="w-9 h-9 rounded-full shadow-md flex items-center justify-center font-bold text-white text-sm relative"
                style={{ background: palette.accentGradient }}
              >
                {(me?.name || '?').charAt(0).toUpperCase()}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl border bg-white dark:bg-[#161c24] border-gray-200 dark:border-gray-800 p-2 z-40 text-xs">
                <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                  <p className="font-bold text-sm">{me?.name || 'Admin'}</p>
                  <span className="mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    {me?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN'}
                  </span>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      router.push('/admin/users/profile');
                      setIsProfileOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <span>My Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/admin/settings');
                      setIsProfileOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/');
                      setIsProfileOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors font-medium"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                    <span>Return to Main App</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-rose-500/10 text-rose-500 transition-colors font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Dialog Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
