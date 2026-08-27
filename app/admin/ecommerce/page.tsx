"use client";

import React from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { AreaChart, RadialBarChart, BarChart } from '@/components/admin/MinimalCharts';
import { DollarSign, ShoppingBag, CreditCard, TrendingUp, Star, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';

export default function EcommerceDashboard() {
  const { palette, mode } = useAdminTheme();

  return (
    <div className="space-y-8">
      {/* Header Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight">E-Commerce Overview</h1>
        <p className="text-xs text-gray-400">Welcome back! Here is what is happening with your online store today.</p>
      </div>

      {/* 4 Revenue Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Sales', amount: '$48,520.00', trend: '+14.2%', icon: DollarSign, color: palette.primary },
          { title: 'Total Profit', amount: '$18,240.50', trend: '+9.8%', icon: TrendingUp, color: '#22c55e' },
          { title: 'Total Expenses', amount: '$12,400.00', trend: '-2.4%', icon: CreditCard, color: '#ff5630' },
          { title: 'Net Income', amount: '$36,120.00', trend: '+18.6%', icon: ShoppingBag, color: '#00b8d9' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`p-6 rounded-3xl border shadow-sm ${
              mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.title}</p>
                <div className="p-2.5 rounded-2xl" style={{ backgroundColor: `${card.color}20`, color: card.color }}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-2xl font-black mt-3">{card.amount}</h3>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                <ArrowUpRight className="w-4 h-4" />
                <span>{card.trend}</span>
                <span className="text-gray-400 font-normal">from last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales vs Expenses Dual Line Chart */}
        <div className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg">Sales & Profit Trends</h3>
              <p className="text-xs text-gray-400">Comparing gross revenue vs net operating income</p>
            </div>
          </div>
          <AreaChart
            categories={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']}
            series={[
              { name: 'Gross Revenue ($k)', data: [28, 35, 42, 38, 55, 62, 70, 85], color: palette.primary },
              { name: 'Net Profit ($k)', data: [12, 18, 22, 20, 31, 38, 45, 54], color: '#22c55e' },
            ]}
          />
        </div>

        {/* Sales Target Radial Bar Chart */}
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col items-center justify-center ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <h3 className="font-bold text-lg mb-6 w-full text-left">Quarterly Target</h3>
          <RadialBarChart
            percent={82}
            title="$100,000 Revenue Goal"
            subtitle="$82,400 Achieved so far"
          />
        </div>
      </div>

      {/* Top Products & Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Products */}
        <div className={`p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <h3 className="font-bold text-lg mb-1">Top Selling Products</h3>
          <p className="text-xs text-gray-400 mb-4">Best performing catalog items</p>
          <div className="space-y-4">
            {[
              { title: 'iPhone 15 Pro Max', category: 'Electronics', price: '$1,199.00', sales: '840 units', rating: 4.9, icon: '📱' },
              { title: 'MacBook Pro M3 Max', category: 'Laptops', price: '$2,499.00', sales: '420 units', rating: 5.0, icon: '💻' },
              { title: 'AirPods Max Wireless', category: 'Audio', price: '$549.00', sales: '1,120 units', rating: 4.8, icon: '🎧' },
              { title: 'Apple Watch Ultra 2', category: 'Wearables', price: '$799.00', sales: '650 units', rating: 4.9, icon: '⌚' },
            ].map((p) => (
              <div key={p.title} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl shadow-sm">
                    {p.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">{p.title}</h4>
                    <p className="text-[11px] text-gray-400">{p.sales} • {p.price}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-amber-500">★ {p.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders List */}
        <div className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Recent E-Commerce Orders</h3>
            <span className="text-xs text-primary font-bold hover:underline cursor-pointer">View Catalog →</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3">Total</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                {[
                  { id: '#ORD-7812', customer: 'David Miller', items: '2 Items (MacBook Pro)', total: '$2,499.00', status: 'Delivered' },
                  { id: '#ORD-7813', customer: 'Emma Watson', items: '1 Item (AirPods Max)', total: '$549.00', status: 'Processing' },
                  { id: '#ORD-7814', customer: 'Carlos Rodriguez', items: '3 Items (iPhone + Watch)', total: '$1,998.00', status: 'Delivered' },
                  { id: '#ORD-7815', customer: 'Zainab Ahmed', items: '1 Item (Apple Watch)', total: '$799.00', status: 'Pending' },
                ].map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="py-3 px-3 font-bold text-primary">{row.id}</td>
                    <td className="py-3 px-3 font-semibold">{row.customer}</td>
                    <td className="py-3 px-3 text-gray-400">{row.items}</td>
                    <td className="py-3 px-3 font-bold">{row.total}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        row.status === 'Delivered'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : row.status === 'Processing'
                          ? 'bg-cyan-500/10 text-cyan-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
