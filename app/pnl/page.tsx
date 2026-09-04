'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { getTerm } from '@/lib/terminology';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calculator, LineChart, Wallet, ShoppingCart, Briefcase, FileText, Truck } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProfitAndLossPage() {
  const { user } = useAuthStore();
  const invoices = useLiveQuery(() => db.invoices.filter(i => !i.isDeleted).toArray()) || [];
  const purchases = useLiveQuery(() => db.purchaseOrders.filter(p => !p.isDeleted).toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.filter(e => !e.isDeleted).toArray()) || [];
  const advances = useLiveQuery(() => db.advances.filter(a => !a.isDeleted).toArray()) || []; // Represents Payroll / Peshgi

  // 1. Gross Revenue (Total Sales)
  const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  // 2. Cost of Goods Sold (Total Purchases from Vendors)
  const totalCOGS = purchases.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);

  // 3. Gross Profit
  const grossProfit = totalRevenue - totalCOGS;

  // 4. Operating Expenses (Roznamcha)
  const totalOpEx = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // 5. Payroll / HR Costs (Peshgi given to staff)
  const totalPayroll = advances.reduce((sum, adv) => sum + (Number(adv.amount) || 0), 0);

  // 6. NET PROFIT
  const netProfit = grossProfit - totalOpEx - totalPayroll;
  const isProfitable = netProfit >= 0;

  // Prepare chart data (Last 7 Days)
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const chartData = last7Days.map(dateStr => {
    const dailyRev = invoices.filter(i => String(i.date).startsWith(dateStr)).reduce((s, i) => s + Number(i.total), 0);
    const dailyExp = expenses.filter(e => String(e.date).startsWith(dateStr)).reduce((s, e) => s + Number(e.amount), 0);
    const dailyCOGS = purchases.filter(p => p.date ? String(p.date).startsWith(dateStr) : false).reduce((s, p) => s + Number(p.totalAmount), 0);
    
    return {
      name: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
      Revenue: dailyRev,
      Outflow: dailyExp + dailyCOGS
    };
  });

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-indigo-600" /> True Profit & Loss (P&L)
            </h1>
            <p className="text-xs text-slate-500">Real-time bottom line financial audit</p>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-8 max-w-6xl mx-auto flex flex-col gap-6 w-full">
        
        {/* EXECUTIVE SUMMARY */}
        <div className={`rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 ${isProfitable ? 'bg-slate-900' : 'bg-rose-950'}`}>
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none ${isProfitable ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}></div>
          <div className="relative z-10">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Net Profit (Bottom Line)</p>
            <h2 className={`text-5xl font-black ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfitable ? '+' : '-'} Rs {Math.abs(netProfit).toLocaleString()}
            </h2>
            <p className="text-slate-400 text-sm mt-2">After all purchases, expenses, and payroll deductions.</p>
          </div>
          <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center min-w-[200px]">
            <p className="text-xs text-slate-300 font-bold uppercase mb-1">Gross Margin</p>
            <p className="text-3xl font-black text-white">
              {totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* INCOME COLUMN */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" /> Total Income
            </h3>
            
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-slate-700 text-sm">{getTerm(user, 'pos')} (Revenue)</span>
              </div>
              <span className="font-black text-emerald-600">Rs {totalRevenue.toLocaleString()}</span>
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="font-bold text-slate-500 text-xs uppercase">Total Inflow</span>
              <span className="font-black text-slate-800 text-xl">Rs {totalRevenue.toLocaleString()}</span>
            </div>
          </div>

          {/* EXPENSES COLUMN */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4 relative overflow-hidden lg:col-span-2">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-500" /> Total Outflows & Deductions
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-2 text-rose-700 mb-1">
                  <Truck className="w-4 h-4" /> <span className="font-bold text-xs uppercase">{getTerm(user, 'vendors')} (COGS)</span>
                </div>
                <span className="font-black text-rose-600 text-lg">Rs {totalCOGS.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium">Vendor Invoices</span>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <div className="flex items-center gap-2 text-orange-700 mb-1">
                  <Wallet className="w-4 h-4" /> <span className="font-bold text-xs uppercase">Operating Exp.</span>
                </div>
                <span className="font-black text-orange-600 text-lg">Rs {totalOpEx.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium">Roznamcha / Daily Bills</span>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-2 text-purple-700 mb-1">
                  <Briefcase className="w-4 h-4" /> <span className="font-bold text-xs uppercase">{getTerm(user, 'staff')} (Payroll)</span>
                </div>
                <span className="font-black text-purple-600 text-lg">Rs {totalPayroll.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 font-medium">Staff Peshgi / Salaries</span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="font-bold text-slate-500 text-xs uppercase">Total Outflow</span>
              <span className="font-black text-slate-800 text-xl">Rs {(totalCOGS + totalOpEx + totalPayroll).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* VISUAL CHART */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <LineChart className="w-5 h-5 text-indigo-500" /> Revenue vs Outflow (Last 7 Days)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `Rs ${v}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="Outflow" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </main>
  );
}
