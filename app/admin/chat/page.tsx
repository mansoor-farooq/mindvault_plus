"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Search, Send, Image as ImageIcon, Paperclip, Phone, Video, MoreVertical, CheckCheck } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

export default function ChatAppPage() {
  const { palette, mode } = useAdminTheme();
  const [activeContact, setActiveContact] = useState({ name: 'Sarah Jenkins', avatar: 'SJ', status: 'Online' });
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'them', text: 'Hey Admin! The Minimal UI Dashboard layout is looking incredible.', time: '10:14 AM' },
    { id: '2', sender: 'me', text: 'Thanks Sarah! We just integrated the dark mode engine and customizer drawer.', time: '10:16 AM' },
    { id: '3', sender: 'them', text: 'Awesome! Can we double check the analytics metrics charts?', time: '10:18 AM' },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'me',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    const currentInput = inputText;
    setInputText('');

    // Simulate auto-reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'them',
          text: `Got it! Noted regarding "${currentInput}". I will check the stats right away!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1200);
  };

  return (
    <div className={`h-[calc(100vh-140px)] rounded-3xl border shadow-sm flex overflow-hidden ${
      mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
    }`}>
      {/* Left Contacts Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <h2 className="font-bold text-lg">Chats</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs font-medium outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/40">
          {[
            { name: 'Sarah Jenkins', avatar: 'SJ', message: 'Awesome! Can we double check...', time: '10:18 AM', online: true },
            { name: 'Marcus Vance', avatar: 'MV', message: 'JWT admin auth is verified.', time: '9:45 AM', online: true },
            { name: 'Ayesha Khan', avatar: 'AK', message: 'Report generated successfully.', time: 'Yesterday', online: false },
          ].map((c) => (
            <button
              key={c.name}
              onClick={() => setActiveContact({ name: c.name, avatar: c.avatar, status: c.online ? 'Online' : 'Offline' })}
              className={`w-full p-4 text-left flex items-center gap-3 transition-colors ${
                activeContact.name === c.name ? 'bg-primary-light/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`}
            >
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-xs shadow-sm"
                  style={{ background: palette.accentGradient }}
                >
                  {c.avatar}
                </div>
                {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#161c24]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold truncate">{c.name}</h4>
                  <span className="text-[10px] text-gray-400">{c.time}</span>
                </div>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.message}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Active Chat Pane */}
      <div className="flex-1 flex flex-col">
        {/* Chat Top Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-xs shadow-sm"
              style={{ background: palette.accentGradient }}
            >
              {activeContact.avatar}
            </div>
            <div>
              <h3 className="font-bold text-sm">{activeContact.name}</h3>
              <span className="text-[10px] text-emerald-500 font-semibold">{activeContact.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <button className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"><Phone className="w-4 h-4" /></button>
            <button className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"><Video className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Message History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'me' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  m.sender === 'me'
                    ? 'text-white font-medium rounded-tr-none'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-none'
                }`}
                style={{ background: m.sender === 'me' ? palette.accentGradient : undefined }}
              >
                {m.text}
              </div>
              <span className="text-[9px] text-gray-400 mt-1">{m.time}</span>
            </div>
          ))}
        </div>

        {/* Message Input Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs font-semibold outline-none"
          />
          <button
            type="submit"
            className="p-3 rounded-xl text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: palette.accentGradient }}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
