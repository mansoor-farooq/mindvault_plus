'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Wallet, Expense, AuditLog } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { SyncService } from '@/services/SyncService';
import { Wallet as WalletIcon, ArrowRightLeft, TrendingDown, History, Plus, Building2, Smartphone, Banknote, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function FinanceDashboard() {
  const { user } = useAuthStore();
  const wallets = useLiveQuery(() => db.wallets.filter(w => !w.isDeleted).toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.filter(e => !e.isDeleted).reverse().limit(50).toArray()) || [];
  const auditLogs = useLiveQuery(() => db.auditLogs.where('entity').anyOf(['WALLET', 'EXPENSE']).filter(a => !a.isDeleted).reverse().limit(20).toArray()) || [];

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Wallet Form
  const [wName, setWName] = useState('');
  const [wType, setWType] = useState<'CASH'|'BANK'|'MOBILE'>('CASH');
  const [wBalance, setWBalance] = useState('');

  // Expense Form
  const [eAmount, setEAmount] = useState('');
  const [eWalletId, setEWalletId] = useState('');
  const [eCategory, setECategory] = useState('Rent');
  const [eDesc, setEDesc] = useState('');

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

  const handleCreateWallet = async () => {
    if (!wName || !wBalance) return;
    const syncId = crypto.randomUUID();
    const balanceNum = Number(wBalance);

    await db.transaction('rw', db.wallets, db.auditLogs, async () => {
      await db.wallets.add({
        syncId,
        name: wName,
        type: wType,
        balance: balanceNum,
        currency: 'PKR',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Audit Log
      await db.auditLogs.add({
        syncId: crypto.randomUUID(),
        action: 'CREATE',
        entity: 'WALLET',
        entityId: syncId,
        userId: user?.id?.toString() || 'SYSTEM',
        details: JSON.stringify({ name: wName, balance: balanceNum }),
        timestamp: new Date().toISOString()
      });
    });
    SyncService.sync();
    setShowWalletModal(false);
    setWName(''); setWBalance('');
  };

  const handleLogExpense = async () => {
    if (!eAmount || !eWalletId || !eCategory) return;
    const wallet = wallets.find(w => w.syncId === eWalletId);
    if (!wallet) return;

    const syncId = crypto.randomUUID();
    const numAmount = Number(eAmount);

    await db.transaction('rw', db.wallets, db.expenses, db.auditLogs, async () => {
      // Deduct from wallet
      await db.wallets.update(wallet.id!, { balance: wallet.balance - numAmount });
      
      // Log expense
      await db.expenses.add({
        syncId,
        category: eCategory,
        amount: numAmount,
        walletId: eWalletId,
        date: new Date().toISOString(),
        description: eDesc,
        isDeleted: false,
        loggedBy: user?.fullName || 'Unknown'
      });

      // Audit Log
      await db.auditLogs.add({
        syncId: crypto.randomUUID(),
        action: 'CREATE',
        entity: 'EXPENSE',
        entityId: syncId,
        userId: user?.id?.toString() || 'SYSTEM',
        details: JSON.stringify({ category: eCategory, amount: numAmount, wallet: wallet.name }),
        timestamp: new Date().toISOString()
      });
    });

    SyncService.sync();
    setShowExpenseModal(false);
    setEAmount(''); setEDesc('');
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm('Are you sure you want to delete this expense? Funds will be restored to the wallet.')) return;
    await db.transaction('rw', db.wallets, db.expenses, db.auditLogs, async () => {
      const wallet = wallets.find(w => w.syncId === expense.walletId);
      if (wallet && wallet.id) {
        await db.wallets.update(wallet.id, { balance: wallet.balance + expense.amount });
      }
      await db.expenses.update(expense.id!, { isDeleted: true, deletedAt: new Date().toISOString() });
      await db.auditLogs.add({
        syncId: crypto.randomUUID(),
        action: 'DELETE',
        entity: 'EXPENSE',
        entityId: expense.syncId || '',
        userId: user?.id?.toString() || 'SYSTEM',
        details: JSON.stringify({ category: expense.category, amount: expense.amount, refundedTo: wallet?.name }),
        timestamp: new Date().toISOString()
      });
    });
    SyncService.sync();
  };

  const getWalletIcon = (type: string) => {
    if (type === 'BANK') return <Building2 className="w-6 h-6" />;
    if (type === 'MOBILE') return <Smartphone className="w-6 h-6" />;
    return <Banknote className="w-6 h-6" />;
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 flex items-center justify-between z-30 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <WalletIcon className="w-5 h-5 text-emerald-600" /> Roznamcha & Wallets
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setShowExpenseModal(true)} className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
            <TrendingDown className="w-4 h-4" /> Log Expense
          </button>
          <button onClick={() => setShowWalletModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-emerald-600/20">
            <Plus className="w-4 h-4" /> Add Wallet
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-7xl mx-auto flex flex-col gap-8 w-full">
        
        {/* TOTALS */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Total Company Liquidity</p>
            <h2 className="text-5xl font-black text-emerald-400">Rs {totalBalance.toLocaleString()}</h2>
            <p className="text-slate-500 text-sm mt-2">Across {wallets.length} active wallets/accounts</p>
          </div>
        </div>

        {/* WALLETS GRID */}
        <div>
          <h3 className="font-bold text-slate-800 mb-4 text-lg">Active Wallets & Accounts</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {wallets.length === 0 && <p className="text-slate-500 col-span-3">No wallets found. Create one to start tracking cash.</p>}
            {wallets.map(w => (
              <div key={w.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  {getWalletIcon(w.type)}
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 mb-4 border border-slate-100">
                  {getWalletIcon(w.type)}
                </div>
                <p className="font-bold text-slate-800 text-lg">{w.name}</p>
                <p className="text-xs text-slate-400 font-bold mb-4">{w.type}</p>
                <h4 className="text-2xl font-black text-emerald-600">Rs {w.balance.toLocaleString()}</h4>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* RECENT EXPENSES */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-500" /> Recent Expenses (Roznamcha)
            </h3>
            <div className="flex flex-col gap-4">
              {expenses.length === 0 && <p className="text-slate-500 text-sm">No expenses logged yet.</p>}
              {expenses.map(e => {
                const w = wallets.find(w => w.syncId === e.walletId);
                return (
                  <div key={e.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800">{e.category}</p>
                      <p className="text-xs text-slate-500">{new Date(e.date).toLocaleString()} • Paid via {w?.name || 'Unknown'}</p>
                      {e.description && <p className="text-sm text-slate-600 mt-1">{e.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black text-rose-600">- Rs {e.amount.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">By {e.loggedBy}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Expense & Refund Wallet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECURE AUDIT LOGS */}
          <div className="bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-800 text-slate-200">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" /> Immutable Audit Trail
            </h3>
            <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {auditLogs.length === 0 && <p className="text-slate-500 text-sm">No audit logs available.</p>}
              {auditLogs.map((log: AuditLog) => (
                <div key={log.id} className="flex gap-3 items-start border-b border-slate-800 pb-4 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                    <History className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300">
                      <span className="font-bold text-white">{log.userId === 'SYSTEM' ? 'System' : 'User'}</span> performed <span className="font-bold text-indigo-400">{log.action}</span> on <span className="font-bold text-emerald-400">{log.entity}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                    <pre className="mt-2 text-[10px] bg-slate-950 p-2 rounded-lg text-slate-400 overflow-x-auto border border-slate-800">
                      {log.details}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* MODALS */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-slate-800">Create New Wallet</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Wallet Name</label>
                <input type="text" value={wName} onChange={e => setWName(e.target.value)} placeholder="e.g. Meezan Bank, Cash Drawer" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                <select value={wType} onChange={(e: any) => setWType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none">
                  <option value="CASH">Physical Cash</option>
                  <option value="BANK">Bank Account</option>
                  <option value="MOBILE">Mobile Wallet (EasyPaisa/JazzCash)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Initial Balance (Rs)</label>
                <input type="number" value={wBalance} onChange={e => setWBalance(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowWalletModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleCreateWallet} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200">Create</button>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-slate-800">Log Daily Expense</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Amount (Rs)</label>
                <input type="number" value={eAmount} onChange={e => setEAmount(e.target.value)} placeholder="500" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-rose-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Category (Dynamic)</label>
                {/* Allow any dynamic text for true Odoo/ERPNext style flexibility */}
                <input type="text" list="expense-cats" value={eCategory} onChange={e => setECategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-rose-500 outline-none" />
                <datalist id="expense-cats">
                  <option value="Tea & Snacks" />
                  <option value="Fuel & Transport" />
                  <option value="Electricity Bill" />
                  <option value="Internet Bill" />
                  <option value="Stationery" />
                  <option value="Maintenance" />
                </datalist>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Paid From Wallet</label>
                <select value={eWalletId} onChange={e => setEWalletId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-rose-500 outline-none">
                  <option value="">Select a wallet...</option>
                  {wallets.map(w => <option key={w.id} value={w.syncId}>{w.name} (Balance: Rs {w.balance})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Description (Optional)</label>
                <input type="text" value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="e.g., Evening tea for guests" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-rose-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={handleLogExpense} disabled={!eWalletId || !eAmount} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 disabled:opacity-50">Log Expense</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
