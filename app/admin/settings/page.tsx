"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Settings, Shield, Bell, CreditCard, User, CheckCircle2, Key } from 'lucide-react';

export default function AccountSettingsPage() {
  const { palette, mode } = useAdminTheme();
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'notifications' | 'billing'>('general');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Account & System Settings</h1>
        <p className="text-xs text-gray-400">Manage admin credentials, security preferences & billing subscription</p>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span>Account settings updated successfully!</span>
        </div>
      )}

      {/* Tabs */}
      <div className={`p-2 rounded-2xl border flex gap-2 text-xs font-bold ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        {[
          { key: 'general', label: 'General Info', icon: User },
          { key: 'security', label: 'Security & 2FA', icon: Key },
          { key: 'notifications', label: 'Notifications', icon: Bell },
          { key: 'billing', label: 'Billing Plan', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                isSelected
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              style={{ backgroundColor: isSelected ? palette.primary : undefined }}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <form onSubmit={handleSave} className={`p-6 rounded-3xl border shadow-sm space-y-6 ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        {activeTab === 'general' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base border-b border-gray-200 dark:border-gray-800 pb-3">
              Profile Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400">Full Name</label>
                <input
                  type="text"
                  defaultValue="Admin User"
                  className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400">Email Address</label>
                <input
                  type="email"
                  defaultValue="admin@minimals.cc"
                  className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base border-b border-gray-200 dark:border-gray-800 pb-3">
              Change Password & Authentication
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400">Current Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400">New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base border-b border-gray-200 dark:border-gray-800 pb-3">
              Current Subscription Plan
            </h3>
            <div className="p-4 rounded-2xl border border-primary/40 bg-primary-light/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-primary">Active Plan</span>
                <h4 className="text-lg font-black mt-0.5">Enterprise Minimal UI Kit (LIFETIME)</h4>
                <p className="text-xs text-gray-400">Unlimited users, full source code & priority updates</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: palette.accentGradient }}
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
