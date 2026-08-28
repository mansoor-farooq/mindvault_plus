'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, PiggyBank, Plus, Target, CheckCircle2, TrendingUp, Search } from 'lucide-react';
import Link from 'next/link';
import Confetti from 'react-confetti';

export default function GulluckPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  
  const [showAddMoneyId, setShowAddMoneyId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');

  const [showConfetti, setShowConfetti] = useState(false);

  const gullucks = useLiveQuery(() => db.gullucks.reverse().toArray(), []) || [];

  const handleCreateGulluck = async () => {
    if (!name || !targetAmount) return;
    await db.gullucks.add({
      syncId: crypto.randomUUID(),
      name,
      targetAmount: Number(targetAmount),
      savedAmount: 0,
      createdAt: new Date()
    });
    SyncService.sync();
    setShowAddModal(false);
    setName('');
    setTargetAmount('');
  };

  const handleAddMoney = async (id: number, currentSaved: number, target: number) => {
    if (!addAmount) return;
    const newTotal = currentSaved + Number(addAmount);
    await db.gullucks.update(id, { savedAmount: newTotal });
    
    if (newTotal >= target && currentSaved < target) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
    
    SyncService.sync();
    setShowAddMoneyId(null);
    setAddAmount('');
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-20 relative overflow-hidden">
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} />}
      
      <header className="bg-gradient-to-r from-rose-500 to-pink-600 text-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <PiggyBank className="w-6 h-6" /> Gulluck Goals
          </h1>
        </div>
        <button onClick={() => setShowAddModal(true)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4 max-w-4xl w-full mx-auto flex flex-col gap-6 mt-4">
        
        {/* Intro Widget */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center gap-6 justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Save for your dreams.</h2>
            <p className="text-slate-500 mt-2">Break down big purchases into small, achievable savings goals.</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="relative z-10 shrink-0 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-200 transition-all">
            <Plus className="w-5 h-5" /> New Gulluck
          </button>
        </div>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {gullucks.length === 0 ? (
            <div className="col-span-1 md:col-span-2 text-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
              <PiggyBank className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="font-bold text-slate-500">No savings goals yet</h3>
              <p className="text-sm text-slate-400 mt-1">Start saving for that new phone or vacation today.</p>
            </div>
          ) : (
            gullucks.map(goal => {
              const progress = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
              const isComplete = progress >= 100;

              return (
                <div key={goal.id} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 relative overflow-hidden flex flex-col">
                  {isComplete && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> GOAL REACHED
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-xl text-slate-800">{goal.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Target className="w-3 h-3" /> Target: Rs {goal.targetAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                      <PiggyBank className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-2xl font-black text-rose-500">Rs {goal.savedAmount.toLocaleString()}</span>
                      <span className="text-sm font-bold text-slate-400">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden relative">
                      <div 
                        className={\bsolute top-0 left-0 h-full rounded-full transition-all duration-1000 \\}
                        style={{ width: \\%\ }}
                      ></div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex gap-2">
                    {showAddMoneyId === goal.syncId ? (
                      <div className="flex w-full gap-2 animate-in fade-in zoom-in-95">
                        <input 
                          type="number" 
                          value={addAmount} 
                          onChange={e => setAddAmount(e.target.value)} 
                          placeholder="Amount" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500"
                        />
                        <button onClick={() => handleAddMoney(goal.id!, goal.savedAmount, goal.targetAmount)} className="bg-rose-500 text-white px-4 rounded-xl font-bold text-sm shadow-md">Add</button>
                        <button onClick={() => setShowAddMoneyId(null)} className="bg-slate-100 text-slate-500 px-3 rounded-xl font-bold text-sm">X</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowAddMoneyId(goal.syncId!)}
                        disabled={isComplete}
                        className="w-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
                      >
                        <TrendingUp className="w-4 h-4" /> Deposit Savings
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <PiggyBank className="w-6 h-6 text-rose-500" /> Create Savings Goal
            </h2>
            
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Goal Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New iPhone, Honda 125" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-rose-500" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Target Amount (Rs)</label>
              <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="e.g. 50000" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-rose-500" />
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleCreateGulluck} className="flex-1 py-4 font-bold text-white bg-rose-500 rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-600 transition-colors">Start Saving</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
