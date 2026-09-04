'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, Plus, Target, PieChart, Sparkles, TrendingUp, AlertCircle, Loader2, Radar, ArrowRight, Trash2 } from 'lucide-react';
import Link from 'next/link';

const BUDGET_CATEGORIES = ['Grocery', 'Shopping', 'Fuel', 'Investment', 'Utilities', 'Entertainment', 'Health', 'Other'];

export default function BudgetPlannerPage() {
  const { token } = useAuthStore();
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCat, setNewCat] = useState('Grocery');
  const [newLimit, setNewLimit] = useState('');
  
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const budgets = useLiveQuery(
    () => db.budgets.where('month').equals(selectedMonth).filter(b => !b.isDeleted).toArray(),
    [selectedMonth]
  ) || [];

  const expenses = useLiveQuery(
    () => db.ledgerEntries.where('type').equals('EXPENSE').toArray(),
    []
  ) || [];

  // Filter expenses for selected month
  const monthlyExpenses = useMemo(() => {
    return expenses.filter(e => {
      const date = new Date(e.date);
      const mStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      return mStr === selectedMonth;
    });
  }, [expenses, selectedMonth]);

  const budgetProgress = useMemo(() => {
    return budgets.map(b => {
      const spent = monthlyExpenses
        .filter(e => e.category === b.category)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const percent = Math.min((spent / b.limitAmount) * 100, 100);
      return { ...b, spent, percent };
    });
  }, [budgets, monthlyExpenses]);

  const handleAddBudget = async () => {
    if (!newLimit || isNaN(Number(newLimit))) return;
    
    const existing = budgets.find(b => b.category === newCat);
    if (existing) {
      await db.budgets.update(existing.id!, { limitAmount: Number(newLimit), updatedAt: new Date().toISOString() });
    } else {
      await db.budgets.add({
        syncId: crypto.randomUUID(),
        category: newCat,
        limitAmount: Number(newLimit),
        month: selectedMonth,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    SyncService.sync();
    setShowAddModal(false);
    setNewLimit('');
  };

  const handleDeleteBudget = async (id: number) => {
    if (!confirm('Are you sure you want to delete this budget limit?')) return;
    await db.budgets.update(id, { isDeleted: true, updatedAt: new Date().toISOString() });
    SyncService.sync();
  };

  const getAiAdvice = async () => {
    if (budgets.length === 0) return;
    setIsAiLoading(true);
    setAiAdvice(null);
    try {
      const res = await fetch('/api/ai/budget-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          month: selectedMonth,
          budgets: budgetProgress.map(b => ({ category: b.category, limit: b.limitAmount, spent: b.spent })),
          expenses: monthlyExpenses.map(e => ({ category: e.category, amount: e.amount }))
        })
      });
      const data = await res.json();
      if (data.advice) setAiAdvice(data.advice);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen pb-20">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 shadow-lg flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <PieChart className="w-5 h-5" /> Smart Budget
          </h1>
        </div>
        <button onClick={() => setShowAddModal(true)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 max-w-2xl w-full mx-auto flex flex-col gap-6 mt-4">
        
        {/* Month Selector */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-700">Select Month</h2>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border-gray-200 rounded-lg text-sm text-gray-700 p-2"
          />
        </div>

        {/* AI Advisor Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <h2 className="font-bold text-indigo-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" /> AI Financial Advisor
            </h2>
            <button 
              onClick={getAiAdvice}
              disabled={isAiLoading || budgets.length === 0}
              className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
            >
              {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Analyze Month
            </button>
          </div>
          
          {budgets.length === 0 && !aiAdvice && (
            <p className="text-sm text-indigo-600/70">Set up your budgets below to get personalized AI advice for managing your month bestly!</p>
          )}

          {aiAdvice && (
            <div className="mt-3 bg-white/60 p-4 rounded-xl text-sm text-indigo-900 leading-relaxed border border-white/40 shadow-sm animate-in fade-in">
              {aiAdvice}
            </div>
          )}
        </div>

        {/* Budgets List */}
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mt-2">
          <Target className="w-5 h-5 text-emerald-500" /> Your Limits
        </h2>

        {budgetProgress.length === 0 ? (
          <div className="text-center p-8 bg-gray-100/50 rounded-2xl border border-dashed border-gray-300">
            <PieChart className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No budgets set for {selectedMonth}</p>
            <button onClick={() => setShowAddModal(true)} className="mt-4 text-emerald-600 font-bold text-sm">
              + Create your first budget
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {budgetProgress.map(b => (
              <div key={b.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-gray-700">{b.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">
                      Rs {b.spent.toLocaleString()} / <span className="text-gray-900 font-bold">Rs {b.limitAmount.toLocaleString()}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(b.id!)}
                      className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Budget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      b.percent >= 100 ? 'bg-rose-500' : b.percent > 80 ? 'bg-orange-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${b.percent}%` }}
                  ></div>
                </div>
                
                {b.percent >= 100 && (
                  <p className="text-xs text-rose-500 font-bold mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Over budget limit!
                  </p>
                )}
                {b.percent >= 80 && b.percent < 100 && (
                  <p className="text-xs text-amber-500 font-bold mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Nearing budget limit.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Sale Radar CTA */}
        <Link href="/sale-alerts" className="mt-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white p-5 rounded-3xl shadow-lg shadow-rose-200 flex items-center justify-between hover:-translate-y-1 hover:shadow-xl transition-all">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Radar className="w-5 h-5 animate-pulse" /> Sale Radar
            </h3>
            <p className="text-sm text-rose-100 mt-1">Running low on budget? Find live sales near you!</p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>
      </div>

      {/* Add Budget Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-lg font-bold text-gray-800">Set Monthly Budget</h2>
            
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Category</label>
              <select 
                value={newCat} 
                onChange={e => setNewCat(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500"
              >
                {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Maximum Limit (Rs)</label>
              <input 
                type="number" 
                value={newLimit} 
                onChange={e => setNewLimit(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleAddBudget} className="flex-1 py-3 font-bold text-white bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200">Save Limit</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
