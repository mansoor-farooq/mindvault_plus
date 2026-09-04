'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, KametiPayment } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, Users, Plus, CheckCircle2, Circle, Trophy, Calendar, Check, AlertCircle, Settings2, Trash2, ChevronDown } from 'lucide-react';
import Link from 'next/link';

export default function KametiManagerPage() {
  const [showCreate, setShowCreate] = useState(false);
  
  // New Kameti Form State
  const [name, setName] = useState('');
  const [poolAmount, setPoolAmount] = useState('');
  const [perMemberAmount, setPerMemberAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [drawDate, setDrawDate] = useState<number>(1);
  
  // Payout slots (array of strings, length = duration)
  const [slots, setSlots] = useState<string[]>(Array(10).fill(''));

  const [selectedKametiId, setSelectedKametiId] = useState<string | null>(null);

  const kametis = useLiveQuery(() => db.kametis.filter(k => !k.isDeleted).reverse().toArray(), []) || [];
  const payments = useLiveQuery(
    () => selectedKametiId ? db.kametiPayments.where('kametiId').equals(selectedKametiId).filter(p => !p.isDeleted).toArray() : [],
    [selectedKametiId]
  ) || [];

  const handleDurationChange = (val: number) => {
    setDurationMonths(val);
    setSlots(prev => {
      const newSlots = [...prev];
      if (val > prev.length) {
        return [...newSlots, ...Array(val - prev.length).fill('')];
      } else {
        return newSlots.slice(0, val);
      }
    });
  };

  const handleSlotChange = (index: number, val: string) => {
    const newSlots = [...slots];
    newSlots[index] = val;
    setSlots(newSlots);
  };

  const calculatePerMember = () => {
    const pool = Number(poolAmount) || 0;
    if (pool === 0 || durationMonths === 0) return 0;
    return Math.round(pool / durationMonths);
  };

  const handleCreateKameti = async () => {
    if (!name || !poolAmount || durationMonths < 2) return;
    
    // Fill empty slots with placeholder if manager didn't specify
    const finalSlots = slots.map((s, i) => s.trim() ? s.trim() : `Member ${i + 1}`);

    const pool = Number(poolAmount);
    const perMember = calculatePerMember();
    const kametiSyncId = crypto.randomUUID();

    await db.kametis.add({
      syncId: kametiSyncId,
      name,
      poolAmount: pool,
      perMemberAmount: perMember,
      memberCount: durationMonths, // Legacy compatibility
      durationMonths: durationMonths,
      drawDate: drawDate,
      status: 'ACTIVE',
      startDate,
      members: finalSlots,
      createdAt: new Date().toISOString(),
    });

    // Create payment slots
    const paymentRecords = [];
    // Identify unique members to track who pays in each month
    const uniqueMembers = Array.from(new Set(finalSlots));

    for (let month = 1; month <= durationMonths; month++) {
      // In a real Kameti, EVERY member pays every month (except sometimes the receiver, but usually they pay too).
      // A person who holds 2 slots should theoretically pay 2x.
      // To keep it simple and accurate to the diary format: 
      // We will create 1 payment record per slot per month.
      // So if Ali has Slot 1 and Slot 5, Ali pays for slot 1 and slot 5.
      for (const member of finalSlots) {
        paymentRecords.push({
          syncId: crypto.randomUUID(),
          kametiId: kametiSyncId,
          memberName: member,
          monthNumber: month,
          isPaid: false,
        });
      }
    }
    await db.kametiPayments.bulkAdd(paymentRecords);
    
    SyncService.sync();
    setShowCreate(false);
    
    // Reset
    setName(''); setPoolAmount(''); setDurationMonths(10); setSlots(Array(10).fill(''));
  };

  const togglePayment = async (paymentId: number, currentStatus: boolean) => {
    await db.kametiPayments.update(paymentId, { 
      isPaid: !currentStatus, 
      paidAt: !currentStatus ? new Date().toISOString() : undefined 
    });
    SyncService.sync();
  };

  const selectedKameti = kametis.find(k => k.syncId === selectedKametiId);

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen pb-20">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 shadow-lg flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" /> Digital Kameti
          </h1>
        </div>
        {!selectedKametiId && (
          <button onClick={() => setShowCreate(true)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full">
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4 max-w-2xl w-full mx-auto flex flex-col gap-6 mt-2">

        {/* List View */}
        {!selectedKametiId && (
          <div className="flex flex-col gap-4">
            {kametis.length === 0 ? (
              <div className="text-center p-10 bg-white rounded-3xl border border-dashed border-emerald-200">
                <Users className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-700 text-lg">No Kametis Found</h3>
                <p className="text-sm text-gray-500 mt-2">Start your first digital committee to track payments with absolute zero confusion.</p>
                <button onClick={() => setShowCreate(true)} className="mt-6 bg-emerald-600 text-white font-bold px-6 py-3 rounded-full shadow-lg shadow-emerald-200">
                  + Start New Kameti
                </button>
              </div>
            ) : (
              kametis.map(k => (
                <div key={k.id} onClick={() => setSelectedKametiId(k.syncId!)} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{k.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-4 h-4" /> {k.durationMonths || k.memberCount} Months • Starts {k.startDate}
                      </p>
                      {k.status && (
                        <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-1 rounded-full ${k.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                          {k.status}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-600 font-black text-xl">Rs {k.poolAmount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Pool</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Detail View */}
        {selectedKameti && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-right-4">
            <button onClick={() => setSelectedKametiId(null)} className="text-emerald-600 font-bold text-sm flex items-center gap-1 -mb-2 w-max">
              <ArrowLeft className="w-4 h-4" /> Back to Kametis
            </button>

            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Users className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl font-black">{selectedKameti.name}</h2>
                <div className="flex items-center gap-4 mt-2 text-emerald-100 text-sm font-medium">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {selectedKameti.durationMonths || selectedKameti.memberCount} Months</span>
                  {selectedKameti.drawDate && <span className="flex items-center gap-1"><Trophy className="w-4 h-4" /> Draw: {selectedKameti.drawDate}th</span>}
                </div>
                
                <div className="flex justify-between items-end mt-6 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                  <div>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Installment</p>
                    <p className="font-black text-xl">Rs {selectedKameti.perMemberAmount.toLocaleString()} <span className="text-sm font-normal opacity-80">/ slot</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Total Pool</p>
                    <p className="font-black text-2xl">Rs {selectedKameti.poolAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Months Tracking */}
            <div className="flex flex-col gap-6">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><Settings2 className="w-5 h-5 text-emerald-500" /> Payout &amp; Collection Tracker</h3>
              {Array.from({ length: selectedKameti.durationMonths || selectedKameti.memberCount }).map((_, i) => {
                const monthNum = i + 1;
                const monthPayments = payments.filter((p: KametiPayment) => p.monthNumber === monthNum);
                const payoutReceiver = selectedKameti.members[i];
                
                // Group duplicates (if a person holds 2 slots, they owe 2x payment). 
                // We'll just display them uniquely and combine the count, OR list all slots. 
                // Let's just render the distinct slots clearly.
                
                return (
                  <div key={monthNum} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h3 className="font-black text-emerald-900 flex items-center gap-2 text-lg">
                          Month {monthNum}
                        </h3>
                      </div>
                      <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm shadow-emerald-200">
                        <Trophy className="w-4 h-4 text-emerald-200" /> Receiver: {payoutReceiver || 'Unassigned'}
                      </div>
                    </div>
                    
                    <div className="p-2">
                      {monthPayments.map((p: KametiPayment, idx: number) => (
                        <div key={p.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${p.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {idx + 1}
                            </div>
                            <div>
                              <span className={`font-bold block ${p.isPaid ? 'text-emerald-800' : 'text-slate-700'}`}>
                                {p.memberName}
                              </span>
                              {p.memberName === payoutReceiver && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">This Month's Winner</span>}
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => togglePayment(p.id!, p.isPaid)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              p.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {p.isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4 text-slate-400" />}
                            {p.isPaid ? 'Collected' : 'Pending'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full sm:max-w-md sm:rounded-3xl min-h-screen sm:min-h-max flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10 sm:rounded-t-3xl">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-500" /> Start Real Kameti
                </h2>
                <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="p-5 flex flex-col gap-5 overflow-y-auto">
                <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                  <p>Design your Kameti exactly like a physical diary. Set the total amount, duration, and assign slots to members.</p>
                </div>

                {/* BASICS */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Kameti Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Committee 2026" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 outline-none focus:border-emerald-500 transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Total Pool (Rs)</label>
                    <input type="number" value={poolAmount} onChange={e => setPoolAmount(e.target.value)} placeholder="100000" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-emerald-700 outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Duration</label>
                    <div className="relative">
                      <select value={durationMonths} onChange={e => handleDurationChange(Number(e.target.value))} className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors pr-10">
                        {[5,10,12,15,20,24,30].map(m => <option key={m} value={m}>{m} Months</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-emerald-800 text-xs font-bold uppercase tracking-wider">Per Slot / Month</p>
                    <p className="text-2xl font-black text-emerald-600">Rs {calculatePerMember().toLocaleString()}</p>
                  </div>
                  <Check className="w-8 h-8 text-emerald-200" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Draw Date (e.g. 5th)</label>
                    <input type="number" min="1" max="31" value={drawDate} onChange={e => setDrawDate(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Start Month</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 outline-none focus:border-emerald-500 transition-colors text-sm" />
                  </div>
                </div>

                {/* PAYOUT DIARY */}
                <div className="mt-4 border-t border-gray-100 pt-6">
                  <h3 className="font-black text-slate-800 mb-1">Payout Diary (Slots)</h3>
                  <p className="text-xs text-slate-500 mb-4">Assign who receives the kameti in which month. If Ali holds 2 slots, enter Ali in two different months.</p>
                  
                  <div className="flex flex-col gap-2">
                    {slots.map((slotValue, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-16 shrink-0 bg-slate-100 text-slate-500 font-bold text-xs py-3 text-center rounded-xl border border-slate-200">
                          Month {idx + 1}
                        </div>
                        <input 
                          type="text" 
                          value={slotValue}
                          onChange={e => handleSlotChange(idx, e.target.value)}
                          placeholder={`Enter name for Month ${idx + 1}`}
                          className="flex-1 bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-800 outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-gray-100 mt-auto sticky bottom-0 sm:rounded-b-3xl z-10">
                <button 
                  onClick={handleCreateKameti} 
                  disabled={!name || !poolAmount}
                  className="w-full py-4 font-black text-lg text-white bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
                >
                  Create Kameti Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
