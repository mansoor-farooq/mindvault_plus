"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';

export default function ScheduleCalendarPage() {
  const { palette, mode } = useAdminTheme();

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DATES = Array.from({ length: 31 }, (_, i) => i + 1);

  const EVENTS: Record<number, { title: string; color: string }[]> = {
    18: [{ title: 'Minimal UI Sprint Planning', color: palette.primary }],
    20: [{ title: 'Executive Board Review', color: '#ffab00' }],
    24: [{ title: 'Product Release v5.0', color: '#22c55e' }],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Schedule Calendar</h1>
          <p className="text-xs text-gray-400">Monthly schedule, event planning & deadlines</p>
        </div>
        <button
          onClick={() => alert('Add Event Modal activated')}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2"
          style={{ background: palette.accentGradient }}
        >
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      <div className={`p-6 rounded-3xl border shadow-sm ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-extrabold text-lg">August 2026</h3>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-gray-400 mb-3 uppercase">
          {DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-7 gap-2">
          {DATES.map((date) => {
            const hasEvent = EVENTS[date];
            const isToday = date === 18;
            return (
              <div
                key={date}
                className={`min-h-[90px] p-2 rounded-2xl border transition-all text-xs flex flex-col justify-between ${
                  isToday
                    ? 'border-primary shadow-sm bg-primary-light/10 font-bold'
                    : 'border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                  isToday ? 'bg-primary text-white' : ''
                }`}>
                  {date}
                </span>

                {hasEvent && (
                  <div className="space-y-1 mt-1">
                    {hasEvent.map((ev, idx) => (
                      <div
                        key={idx}
                        className="px-2 py-1 rounded-md text-[9px] font-bold text-white truncate shadow-xs"
                        style={{ backgroundColor: ev.color }}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
