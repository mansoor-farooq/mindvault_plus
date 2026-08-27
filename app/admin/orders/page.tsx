"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { ShoppingBag, Search, CheckCircle2, Clock, Truck, RefreshCw } from 'lucide-react';

export default function CustomerOrdersPage() {
  const { palette, mode } = useAdminTheme();
  const [statusTab, setStatusTab] = useState<'All' | 'Completed' | 'Processing' | 'Pending' | 'Cancelled'>('All');

  const ORDERS = [
    { id: '#ORD-9482', customer: 'David Miller', email: 'david@example.com', items: '2 Items', total: '$2,499.00', date: 'Aug 18, 2026', status: 'Completed' },
    { id: '#ORD-9483', customer: 'Emma Watson', email: 'emma@example.com', items: '1 Item', total: '$549.00', date: 'Aug 18, 2026', status: 'Processing' },
    { id: '#ORD-9484', customer: 'Carlos Rodriguez', email: 'carlos@example.com', items: '3 Items', total: '$1,998.00', date: 'Aug 17, 2026', status: 'Completed' },
    { id: '#ORD-9485', customer: 'Zainab Ahmed', email: 'zainab@example.com', items: '1 Item', total: '$799.00', date: 'Aug 16, 2026', status: 'Pending' },
    { id: '#ORD-9486', customer: 'Liam O\'Connor', email: 'liam@example.com', items: '4 Items', total: '$3,150.00', date: 'Aug 15, 2026', status: 'Cancelled' },
  ];

  const filteredOrders = ORDERS.filter((o) => statusTab === 'All' || o.status === statusTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Customer Orders</h1>
        <p className="text-xs text-gray-400">Track fulfillment status, shipping & buyer invoices</p>
      </div>

      <div className={`rounded-3xl border shadow-sm overflow-hidden ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-6 text-xs font-bold">
          {(['All', 'Completed', 'Processing', 'Pending', 'Cancelled'] as const).map((tab) => {
            const count = tab === 'All' ? ORDERS.length : ORDERS.filter((o) => o.status === tab).length;
            const isSelected = statusTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                  isSelected ? 'border-primary' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
                style={{ borderColor: isSelected ? palette.primary : 'transparent', color: isSelected ? palette.primary : undefined }}
              >
                <span>{tab}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Fulfillment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="py-3.5 px-4 font-bold text-primary">{order.id}</td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold">{order.customer}</p>
                    <p className="text-[10px] text-gray-400">{order.email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-gray-400">{order.items}</td>
                  <td className="py-3.5 px-4 font-bold">{order.total}</td>
                  <td className="py-3.5 px-4 text-gray-400">{order.date}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      order.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : order.status === 'Processing'
                        ? 'bg-cyan-500/10 text-cyan-500'
                        : order.status === 'Pending'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {order.status}
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
