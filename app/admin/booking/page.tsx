"use client";

import React from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { RadialBarChart } from '@/components/admin/MinimalCharts';
import { CalendarDays, Hotel, Plane, CheckCircle2, Clock, User } from 'lucide-react';

export default function BookingDashboard() {
  const { palette, mode } = useAdminTheme();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Booking & Reservations</h1>
        <p className="text-xs text-gray-400">Manage reservations, bookings & customer check-ins</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className={`p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Booked Rooms</p>
            <Hotel className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-2xl font-black mt-2">1,240</h3>
          <p className="text-xs text-emerald-500 font-semibold mt-1">+12.5% this month</p>
        </div>

        <div className={`p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Flight Tickets</p>
            <Plane className="w-6 h-6 text-cyan-500" />
          </div>
          <h3 className="text-2xl font-black mt-2">3,850</h3>
          <p className="text-xs text-emerald-500 font-semibold mt-1">+18.0% this month</p>
        </div>

        <div className={`p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Satisfaction Rate</p>
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black mt-2">96.4%</h3>
          <p className="text-xs text-emerald-500 font-semibold mt-1">Highest rating score</p>
        </div>
      </div>

      {/* Booking Table */}
      <div className={`p-6 rounded-3xl border shadow-sm ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <h3 className="font-bold text-lg mb-4">Recent Guest Reservations</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                <th className="py-3 px-3">Guest Name</th>
                <th className="py-3 px-3">Room / Suite</th>
                <th className="py-3 px-3">Check-In</th>
                <th className="py-3 px-3">Check-Out</th>
                <th className="py-3 px-3">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
              {[
                { name: 'Dr. Evelyn Reed', room: 'Presidential Suite #402', checkIn: 'Aug 18, 2026', checkOut: 'Aug 22, 2026', payment: 'Paid' },
                { name: 'Jonathan Blake', room: 'Deluxe Ocean View #208', checkIn: 'Aug 19, 2026', checkOut: 'Aug 21, 2026', payment: 'Paid' },
                { name: 'Sophia Loren', room: 'Executive Suite #305', checkIn: 'Aug 20, 2026', checkOut: 'Aug 25, 2026', payment: 'Pending' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="py-3.5 px-3 font-bold">{row.name}</td>
                  <td className="py-3.5 px-3 text-gray-400">{row.room}</td>
                  <td className="py-3.5 px-3">{row.checkIn}</td>
                  <td className="py-3.5 px-3">{row.checkOut}</td>
                  <td className="py-3.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      row.payment === 'Paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {row.payment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
