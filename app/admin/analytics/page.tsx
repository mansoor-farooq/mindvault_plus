"use client";

import React from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { AreaChart, DonutChart } from '@/components/admin/MinimalCharts';
import { Eye, Users, Clock, MousePointer, Activity, Globe, CheckCircle2 } from 'lucide-react';

export default function AnalyticsMetricsDashboard() {
  const { palette, mode } = useAdminTheme();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Analytics Metrics</h1>
        <p className="text-xs text-gray-400">Deep audience behavior & performance benchmarks</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Unique Visitors', value: '142,500', sub: '+22.4% this week', icon: Users, color: palette.primary },
          { label: 'Total Page Views', value: '850,200', sub: '+18.1% this week', icon: Eye, color: '#00b8d9' },
          { label: 'Bounce Rate', value: '24.8%', sub: '-3.2% improvement', icon: MousePointer, color: '#22c55e' },
          { label: 'Avg Session Duration', value: '4m 32s', sub: '+45s longer', icon: Clock, color: '#ffab00' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`p-6 rounded-3xl border shadow-sm ${
              mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
                <div className="p-2.5 rounded-2xl" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-2xl font-black mt-3">{item.value}</h3>
              <p className="text-xs font-semibold text-emerald-500 mt-1">{item.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Traffic Sources Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <h3 className="font-bold text-lg mb-1">Website Traffic Overview</h3>
          <p className="text-xs text-gray-400 mb-6">Organic vs Referral vs Social Media channel acquisition</p>
          <AreaChart
            categories={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
            series={[
              { name: 'Organic Search', data: [120, 150, 180, 210, 250, 220, 280], color: palette.primary },
              { name: 'Direct Traffic', data: [80, 95, 110, 130, 145, 135, 160], color: '#00b8d9' },
              { name: 'Social Media', data: [40, 60, 75, 90, 115, 140, 155], color: '#ffab00' },
            ]}
          />
        </div>

        {/* Live Activity Timeline */}
        <div className={`p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <h3 className="font-bold text-lg mb-1">Live Order Timeline</h3>
          <p className="text-xs text-gray-400 mb-6">Real-time system event stream</p>
          <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-800 space-y-6">
            {[
              { title: 'New user registered from USA', time: '2 mins ago', type: 'user' },
              { title: 'Invoice #INV-4902 marked as paid', time: '14 mins ago', type: 'payment' },
              { title: 'Order #ORD-8810 dispatched', time: '42 mins ago', type: 'order' },
              { title: 'System cache cleared & updated', time: '1 hour ago', type: 'system' },
            ].map((node, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-[#161c24]" />
                <h4 className="text-xs font-bold">{node.title}</h4>
                <span className="text-[10px] text-gray-400">{node.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
