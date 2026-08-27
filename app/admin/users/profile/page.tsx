"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { User, Mail, Phone, MapPin, Briefcase, Heart, MessageCircle, Share2, Grid, Users, Image as ImageIcon, Sparkles } from 'lucide-react';

export default function UserProfilePage() {
  const { palette, mode } = useAdminTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'followers' | 'friends' | 'gallery'>('profile');

  return (
    <div className="space-y-6">
      {/* Cover Header Banner */}
      <div className={`rounded-3xl border shadow-sm overflow-hidden ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div
          className="h-48 w-full relative"
          style={{ background: palette.accentGradient }}
        >
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Profile Avatar & Info Overlay */}
        <div className="px-8 pb-6 pt-0 relative flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <div
              className="w-28 h-28 rounded-3xl ring-4 ring-white dark:ring-[#161c24] shadow-2xl flex items-center justify-center font-black text-white text-3xl z-10"
              style={{ background: palette.accentGradient }}
            >
              SJ
            </div>
            <div className="space-y-1 z-10 pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">Sarah Jenkins</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-500 border border-purple-500/30">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium">Lead UI/UX Architect & Product Strategist</p>
              <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> San Francisco, CA</span>
                <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> MindVault Inc.</span>
              </div>
            </div>
          </div>

          {/* Social Stats & Direct Message CTA */}
          <div className="flex items-center gap-6 z-10 border-t md:border-t-0 border-gray-100 dark:border-gray-800 pt-4 md:pt-0">
            <div className="text-center">
              <h4 className="text-lg font-black">1.2k</h4>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Posts</p>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-black">48.5k</h4>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Followers</p>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-black">240</h4>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Following</p>
            </div>
          </div>
        </div>

        {/* Profile Navigation Tabs */}
        <div className="px-8 border-t border-gray-200 dark:border-gray-800 flex gap-8 text-xs font-bold">
          {[
            { key: 'profile', label: 'Profile Feed', icon: User },
            { key: 'followers', label: 'Followers (48.5k)', icon: Users },
            { key: 'friends', label: 'Friends (240)', icon: Users },
            { key: 'gallery', label: 'Gallery', icon: ImageIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 border-b-2 flex items-center gap-2 transition-colors ${
                  isSelected ? 'border-primary' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
                style={{ borderColor: isSelected ? palette.primary : 'transparent', color: isSelected ? palette.primary : undefined }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Body Content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* About Card */}
          <div className={`p-6 rounded-3xl border shadow-sm space-y-4 h-fit ${
            mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <h3 className="font-bold text-base border-b border-gray-200 dark:border-gray-800 pb-3">
              About Sarah
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Passionate about building intuitive user interfaces, scalability, and design systems. Leading the Minimal UI architecture overhaul for enterprise applications.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="font-medium">sarah.jenkins@minimals.cc</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="font-medium">+1 (555) 392-0194</span>
              </div>
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <span className="font-medium">Joined August 2024</span>
              </div>
            </div>
          </div>

          {/* Social Post Feed */}
          <div className="lg:col-span-2 space-y-6">
            {[
              {
                id: '1',
                time: '2 hours ago',
                content: 'Just deployed Minimal UI Dashboard v5.0 with full dark mode support and dynamic color presets! Check out the interactive SVG charts and Kanban board.',
                likes: 342,
                comments: 48,
              },
              {
                id: '2',
                time: '1 day ago',
                content: 'Refactoring the offline-first IndexedDB sync engine for zero data loss across mobile & web devices. Smooth experience!',
                likes: 512,
                comments: 89,
              },
            ].map((post) => (
              <div
                key={post.id}
                className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
                  mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-xs shadow-sm"
                    style={{ background: palette.accentGradient }}
                  >
                    SJ
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">Sarah Jenkins</h4>
                    <span className="text-[10px] text-gray-400">{post.time}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">{post.content}</p>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-6 text-xs text-gray-400 font-semibold">
                  <button className="flex items-center gap-1.5 hover:text-rose-500 transition-colors">
                    <Heart className="w-4 h-4" /> <span>{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <MessageCircle className="w-4 h-4" /> <span>{post.comments}</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-gray-200 transition-colors">
                    <Share2 className="w-4 h-4" /> <span>Share</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'followers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[
            { name: 'Marcus Vance', role: 'Dev Lead', avatar: 'MV' },
            { name: 'Ayesha Khan', role: 'Product Manager', avatar: 'AK' },
            { name: 'Elena Rostova', role: 'UX Designer', avatar: 'ER' },
            { name: 'Liam O\'Connor', role: 'Backend Engineer', avatar: 'LO' },
          ].map((follower) => (
            <div key={follower.name} className={`p-6 rounded-3xl border shadow-sm text-center flex flex-col items-center gap-3 ${
              mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-md"
                style={{ background: palette.accentGradient }}
              >
                {follower.avatar}
              </div>
              <div>
                <h4 className="text-xs font-bold">{follower.name}</h4>
                <p className="text-[10px] text-gray-400">{follower.role}</p>
              </div>
              <button
                className="w-full py-1.5 rounded-xl text-xs font-bold border border-primary text-primary hover:bg-primary hover:text-white transition-all"
              >
                Following
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
