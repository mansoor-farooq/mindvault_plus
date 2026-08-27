"use client";

import React from 'react';
import Link from 'next/link';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Mail, Phone, MapPin, UserPlus, MoreVertical } from 'lucide-react';

export default function UserCardsPage() {
  const { palette, mode } = useAdminTheme();

  const USERS_GRID = [
    { name: 'Sarah Jenkins', role: 'Super Admin', email: 'sarah@minimals.cc', location: 'San Francisco, CA', avatar: 'SJ' },
    { name: 'Marcus Vance', role: 'Dev Lead', email: 'marcus@minimals.cc', location: 'London, UK', avatar: 'MV' },
    { name: 'Ayesha Khan', role: 'Product Manager', email: 'ayesha@minimals.cc', location: 'Karachi, PK', avatar: 'AK' },
    { name: 'Elena Rostova', role: 'UI/UX Designer', email: 'elena@minimals.cc', location: 'Berlin, DE', avatar: 'ER' },
    { name: 'Liam O\'Connor', role: 'Backend Engineer', email: 'liam@minimals.cc', location: 'Dublin, IE', avatar: 'LO' },
    { name: 'David Miller', role: 'Mobile Developer', email: 'david@minimals.cc', location: 'Toronto, CA', avatar: 'DM' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">User Profile Cards</h1>
          <p className="text-xs text-gray-400">Team roster cards view with quick contact triggers</p>
        </div>
        <Link
          href="/admin/users/create"
          className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
          style={{ background: palette.accentGradient }}
        >
          + Add Member
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {USERS_GRID.map((user) => (
          <div
            key={user.name}
            className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-md ${
              mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div
              className="h-24 w-full relative"
              style={{ background: palette.accentGradient }}
            />

            <div className="px-6 pb-6 pt-0 text-center relative flex-1 flex flex-col justify-between -mt-12">
              <div>
                <div
                  className="w-20 h-20 rounded-2xl ring-4 ring-white dark:ring-[#161c24] mx-auto shadow-xl flex items-center justify-center font-black text-white text-xl mb-3"
                  style={{ background: palette.accentGradient }}
                >
                  {user.avatar}
                </div>
                <h3 className="font-bold text-base">{user.name}</h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-light text-primary border border-primary/20">
                  {user.role}
                </span>
                <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {user.location}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-3">
                <a
                  href={`mailto:${user.email}`}
                  className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> Email
                </a>
                <button className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> Call
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
