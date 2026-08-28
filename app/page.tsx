'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { 
  TrendingUp, Users, Package, Wallet, 
  ArrowUpRight, ArrowRight, Receipt, Store 
} from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  // Query Data
  const invoices = useLiveQuery(() => db.invoices.toArray(), []) || [];
  const employees = useLiveQuery(() => db.employees.filter(e => e.isActive).toArray(), []) || [];
  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray(), []) || [];
  const khataTxns = useLiveQuery(() => db.khataTransactions.toArray(), []) || [];
  const ledgerEntries = useLiveQuery(() => db.ledgerEntries.toArray(), []) || [];

  // Derived Metrics
  const metrics = useMemo(() => {
    // 1. Total ERP Revenue
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
    
    // 2. Total Market Receivables (Khata)
    let marketCredit = 0;
    khataTxns.forEach(t => {
      if (t.type === 'CREDIT') marketCredit += Number(t.amount);
      if (t.type === 'DEBIT') marketCredit -= Number(t.amount);
    });

    // 3. Cash/Bank Balance
    let cashBalance = 0;
    ledgerEntries.forEach(e => {
      if (e.type === 'INCOME') cashBalance += Number(e.amount);
      if (e.type === 'EXPENSE') cashBalance -= Number(e.amount);
    });

    return { totalRevenue, marketCredit, cashBalance };
  }, [invoices, khataTxns, ledgerEntries]);

  const recentInvoices = invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      
      {/* Welcome Banner */}
      <div className="bg-indigo-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2">Business Overview</h1>
          <p className="text-indigo-200">Welcome back. Here is what's happening across your company today.</p>
          
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/erp" className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-lg">
              <Receipt className="w-4 h-4" /> Create Invoice
            </Link>
            <Link href="/staff" className="bg-indigo-800 border border-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg">
              <Users className="w-4 h-4" /> Manage Staff
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
              +12% <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Sales</p>
          <p className="text-2xl font-black text-slate-800 mt-1">Rs {metrics.totalRevenue.toLocaleString()}</p>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Store className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Market Credit (Khata)</p>
          <p className="text-2xl font-black text-slate-800 mt-1">Rs {metrics.marketCredit.toLocaleString()}</p>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cash Balance</p>
          <p className="text-2xl font-black text-slate-800 mt-1">Rs {metrics.cashBalance.toLocaleString()}</p>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Factory Staff</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{employees.length}</p>
        </div>
      </div>

      {/* Grid: Recent Invoices & Inventory Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Invoices */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-bold text-lg text-slate-800">Recent Transactions</h2>
            <Link href="/erp" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Invoice ID</th>
                  <th className="p-4 font-semibold">Customer</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Method</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recentInvoices.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No invoices generated yet.</td></tr>
                ) : (
                  recentInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{inv.invoiceNumber}</td>
                      <td className="p-4 text-slate-600">{inv.customerName}</td>
                      <td className="p-4 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={\	ext-[10px] font-bold px-2 py-1 rounded-full \\}>
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-800 text-right">Rs {inv.total.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="bg-slate-900 rounded-3xl shadow-xl p-6 text-white flex flex-col relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <h2 className="font-bold text-lg mb-6 flex items-center gap-2 relative z-10">
            <Package className="w-5 h-5 text-indigo-400" /> Inventory Status
          </h2>
          
          <div className="flex-1 flex flex-col justify-center relative z-10">
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-200 to-white mb-2">
              {products.length}
            </div>
            <p className="text-indigo-200 font-medium">Total Products</p>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 relative z-10">
            <Link href="/inventory" className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
              Manage Stock <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
