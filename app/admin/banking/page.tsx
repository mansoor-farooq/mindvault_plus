"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { BarChart } from '@/components/admin/MinimalCharts';
import { Landmark, CreditCard, Send, ArrowUpRight, ArrowDownLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function BankingFinanceDashboard() {
  const { palette, mode } = useAdminTheme();
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('Sarah Jenkins');
  const [transferSuccess, setTransferSuccess] = useState(false);

  const handleSendMoney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount) return;
    setTransferSuccess(true);
    setTimeout(() => {
      setTransferSuccess(false);
      setTransferAmount('');
    }, 3000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Banking & Finance</h1>
        <p className="text-xs text-gray-400">Manage corporate accounts, cards & cash flow</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Digital Glassmorphism Credit Card */}
        <div className="lg:col-span-2 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden flex flex-col justify-between h-64" style={{ background: palette.accentGradient }}>
          <div className="flex items-center justify-between z-10">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Corporate Account</span>
              <h3 className="text-xl font-extrabold mt-0.5">MindVault Enterprise</h3>
            </div>
            <CreditCard className="w-8 h-8 opacity-90" />
          </div>

          <div className="z-10 my-4">
            <p className="text-xs opacity-75 font-mono">ACCOUNT NUMBER</p>
            <p className="text-xl font-mono tracking-widest font-bold">4892 •••• •••• 9104</p>
          </div>

          <div className="flex items-center justify-between z-10">
            <div>
              <p className="text-[10px] opacity-75 font-mono uppercase">Current Balance</p>
              <p className="text-2xl font-black">$148,920.50</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black italic tracking-widest">VISA</span>
            </div>
          </div>
        </div>

        {/* Quick Money Transfer Form */}
        <div className={`p-6 rounded-3xl border shadow-sm ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <h3 className="font-bold text-lg mb-1">Quick Transfer</h3>
          <p className="text-xs text-gray-400 mb-4">Send funds instantly to saved contacts</p>

          <form onSubmit={handleSendMoney} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400">Recipient</label>
              <select
                value={transferRecipient}
                onChange={(e) => setTransferRecipient(e.target.value)}
                className="w-full mt-1 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-bold"
              >
                <option>Sarah Jenkins (Design Lead)</option>
                <option>Marcus Vance (Dev Lead)</option>
                <option>Ayesha Khan (Product Mgr)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Amount ($)</label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="e.g. 500.00"
                className="w-full mt-1 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-bold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-105"
              style={{ background: palette.accentGradient }}
            >
              <Send className="w-4 h-4" />
              <span>Send Funds Now</span>
            </button>

            {transferSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-bold flex items-center gap-2 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>Successfully sent ${transferAmount} to {transferRecipient}!</span>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Cash Flow Bar Chart */}
      <div className={`p-6 rounded-3xl border shadow-sm ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <h3 className="font-bold text-lg mb-1">Cash Flow Analytics</h3>
        <p className="text-xs text-gray-400 mb-6">Income vs Outflow across months</p>
        <BarChart
          categories={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']}
          series={[
            { name: 'Incoming Cash ($k)', data: [42, 58, 65, 72, 85, 94, 110, 125], color: palette.primary },
            { name: 'Outgoing Expenses ($k)', data: [28, 35, 40, 48, 52, 60, 68, 75], color: '#ff5630' },
          ]}
        />
      </div>
    </div>
  );
}
