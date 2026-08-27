"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Mail, Inbox, Star, Send, File, Trash2, Edit3, Search, Paperclip } from 'lucide-react';

export default function MailClientPage() {
  const { palette, mode } = useAdminTheme();
  const [selectedCategory, setSelectedCategory] = useState<'Inbox' | 'Starred' | 'Sent' | 'Drafts'>('Inbox');
  const [selectedMailId, setSelectedMailId] = useState('1');

  const MAILS = [
    { id: '1', sender: 'Sarah Jenkins', email: 'sarah@minimals.cc', subject: 'Minimal UI v5.0 Sprint Review & Release Notes', snippet: 'Hey team, the dark mode palette and interactive SVG chart components look incredible...', date: '10:14 AM', read: false },
    { id: '2', sender: 'Marcus Vance', email: 'marcus@minimals.cc', subject: 'Security Audit: JWT Verification and Admin RBAC', snippet: 'The endpoints are fully verified against spoofing attempts. We passed all tests cleanly...', date: 'Yesterday', read: true },
    { id: '3', sender: 'Ayesha Khan', email: 'ayesha@minimals.cc', subject: 'Quarterly Sales Goal & Enterprise Licensing', snippet: 'Here is the summary of PRO vs LIFETIME license conversions for August 2026...', date: 'Aug 16', read: true },
  ];

  const activeMail = MAILS.find((m) => m.id === selectedMailId) || MAILS[0];

  return (
    <div className={`h-[calc(100vh-140px)] rounded-3xl border shadow-sm flex overflow-hidden ${
      mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
    }`}>
      {/* Folder Sidebar */}
      <div className="w-56 border-r border-gray-200 dark:border-gray-800 p-4 space-y-6">
        <button
          onClick={() => alert('Compose Email Modal activated')}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2"
          style={{ background: palette.accentGradient }}
        >
          <Edit3 className="w-4 h-4" /> Compose
        </button>

        <div className="space-y-1">
          {[
            { name: 'Inbox', icon: Inbox, count: 3 },
            { name: 'Starred', icon: Star, count: 0 },
            { name: 'Sent', icon: Send, count: 12 },
            { name: 'Drafts', icon: File, count: 1 },
          ].map((folder) => {
            const Icon = folder.icon;
            const isSelected = selectedCategory === folder.name;
            return (
              <button
                key={folder.name}
                onClick={() => setSelectedCategory(folder.name as any)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-primary-light text-primary font-bold' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{folder.name}</span>
                </div>
                <span className="text-[10px]">{folder.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mail List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-bold text-sm">Inbox</h3>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/40">
          {MAILS.map((mail) => (
            <button
              key={mail.id}
              onClick={() => setSelectedMailId(mail.id)}
              className={`w-full p-4 text-left space-y-1 transition-colors ${
                selectedMailId === mail.id ? 'bg-primary-light/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">{mail.sender}</span>
                <span className="text-[10px] text-gray-400">{mail.date}</span>
              </div>
              <h4 className="text-xs font-semibold line-clamp-1">{mail.subject}</h4>
              <p className="text-[11px] text-gray-400 line-clamp-2">{mail.snippet}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Mail View */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
          <h2 className="text-lg font-black">{activeMail.subject}</h2>
          <div className="flex items-center gap-3 mt-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-xs"
              style={{ background: palette.accentGradient }}
            >
              SJ
            </div>
            <div>
              <h4 className="text-xs font-bold">{activeMail.sender}</h4>
              <p className="text-[11px] text-gray-400">{activeMail.email}</p>
            </div>
          </div>
        </div>

        <div className="text-xs leading-relaxed space-y-4 text-gray-300">
          <p>{activeMail.snippet}</p>
          <p>
            Please let me know if you need any adjustments to the dashboard components or themes before we freeze the current sprint.
          </p>
          <p className="pt-4 font-bold text-gray-400">Best Regards,<br />{activeMail.sender}</p>
        </div>
      </div>
    </div>
  );
}
