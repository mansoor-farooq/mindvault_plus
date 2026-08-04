"use client";

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Udhaar, UdhaarPayment } from '@/lib/db';
import { ArrowLeft, Plus, Wallet, ArrowUpRight, ArrowDownRight, Users, CheckCircle2, History, X } from 'lucide-react';
import Link from 'next/link';

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'UDHAAR'>('LEDGER');
  const [selectedUdhaar, setSelectedUdhaar] = useState<Udhaar | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // Fetch Data
  const ledgerEntries = useLiveQuery(() => db.ledgerEntries.reverse().sortBy('date')) || [];
  const udhaarEntries = useLiveQuery(() => db.udhaar.reverse().sortBy('createdAt')) || [];

  // Ledger Calculations
  const totalIncome = ledgerEntries.filter(e => e.type === 'INCOME').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = ledgerEntries.filter(e => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;

  // Udhaar Calculations
  const getRemainingAmount = (entry: Udhaar) => {
    const totalPaid = (entry.payments || []).reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, entry.amount - totalPaid);
  };

  const totalToGive = udhaarEntries
    .filter(e => e.type === 'TO_GIVE' && !e.isSettled)
    .reduce((sum, e) => sum + getRemainingAmount(e), 0);
    
  const totalToReceive = udhaarEntries
    .filter(e => e.type === 'TO_RECEIVE' && !e.isSettled)
    .reduce((sum, e) => sum + getRemainingAmount(e), 0);

  // Handlers
  const toggleSettle = async (id?: number, currentStatus?: boolean) => {
    if (id !== undefined) {
      await db.udhaar.update(id, { isSettled: !currentStatus });
    }
  };

  const handleAddPayment = async () => {
    if (!selectedUdhaar || !selectedUdhaar.id || !paymentAmount) return;
    
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const newPayment: UdhaarPayment = {
      id: Date.now().toString(),
      amount: amountNum,
      date: new Date(),
    };

    const updatedPayments = [...(selectedUdhaar.payments || []), newPayment];
    const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const isSettled = totalPaid >= selectedUdhaar.amount;

    await db.udhaar.update(selectedUdhaar.id, {
      payments: updatedPayments,
      isSettled: isSettled || selectedUdhaar.isSettled
    });

    setSelectedUdhaar(null);
    setPaymentAmount('');
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen">
      <header className="bg-indigo-900 text-white p-4 flex items-center justify-between shadow-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-indigo-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide">Finance & Udhaar</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-white shadow-sm sticky top-[68px] z-10">
        <button 
          onClick={() => setActiveTab('LEDGER')}
          className={`flex-1 p-4 font-medium text-center border-b-2 transition-colors ${activeTab === 'LEDGER' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}
        >
          Ledger
        </button>
        <button 
          onClick={() => setActiveTab('UDHAAR')}
          className={`flex-1 p-4 font-medium text-center border-b-2 transition-colors ${activeTab === 'UDHAAR' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}
        >
          Udhaar (Loans)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 relative">
        {activeTab === 'LEDGER' ? (
          <div className="space-y-6 animate-fade-in-up">
            {/* Balance Card */}
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2 opacity-80">
                <Wallet className="w-5 h-5" />
                <span className="font-medium">Total Balance</span>
              </div>
              <h2 className="text-4xl font-bold mb-6">Rs. {balance.toLocaleString()}</h2>
              <div className="flex gap-4">
                <div className="flex-1 bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-green-300 text-sm mb-1">
                    <ArrowDownRight className="w-4 h-4" /> Income
                  </div>
                  <p className="font-semibold">Rs. {totalIncome.toLocaleString()}</p>
                </div>
                <div className="flex-1 bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-red-300 text-sm mb-1">
                    <ArrowUpRight className="w-4 h-4" /> Expense
                  </div>
                  <p className="font-semibold">Rs. {totalExpense.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Transactions List */}
            <div>
              <h3 className="font-bold text-gray-800 mb-4 px-1">Recent Transactions</h3>
              {ledgerEntries.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">No transactions yet</div>
              ) : (
                <div className="space-y-3">
                  {ledgerEntries.map(entry => (
                    <div key={entry.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${entry.type === 'INCOME' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {entry.type === 'INCOME' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{entry.category}</p>
                          <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className={`font-bold ${entry.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.type === 'INCOME' ? '+' : '-'} Rs. {entry.amount}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            {/* Udhaar Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100">
                <div className="flex items-center gap-2 mb-2 text-red-500">
                  <ArrowUpRight className="w-5 h-5" />
                  <span className="font-medium text-sm">To Give</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Rs. {totalToGive.toLocaleString()}</h2>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100">
                <div className="flex items-center gap-2 mb-2 text-green-500">
                  <ArrowDownRight className="w-5 h-5" />
                  <span className="font-medium text-sm">To Receive</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Rs. {totalToReceive.toLocaleString()}</h2>
              </div>
            </div>

            {/* Udhaar List */}
            <div>
              <h3 className="font-bold text-gray-800 mb-4 px-1">Active Records</h3>
              {udhaarEntries.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">No Udhaar records</div>
              ) : (
                <div className="space-y-4">
                  {udhaarEntries.map(entry => {
                    const remaining = getRemainingAmount(entry);
                    const isFullyPaid = remaining <= 0;
                    const statusText = entry.isSettled || isFullyPaid ? 'Settled' : (remaining < entry.amount ? 'Partially Paid' : 'Pending');

                    return (
                      <div key={entry.id} className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col gap-3 ${entry.isSettled ? 'opacity-60 border-gray-100' : entry.type === 'TO_GIVE' ? 'border-red-50' : 'border-green-50'}`}>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-gray-50 text-gray-600 rounded-full">
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <p className={`font-semibold ${entry.isSettled ? 'line-through text-gray-500' : 'text-gray-900'}`}>{entry.personName}</p>
                              <p className="text-xs text-gray-500">
                                {entry.type === 'TO_GIVE' ? 'You have to give' : 'You will receive'} • {statusText}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 line-through">Rs. {entry.amount}</p>
                            <p className={`font-bold ${entry.isSettled ? 'text-gray-400' : entry.type === 'TO_GIVE' ? 'text-red-600' : 'text-green-600'}`}>
                              Rs. {remaining}
                            </p>
                          </div>
                        </div>

                        {!entry.isSettled && (
                          <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-50">
                            <button 
                              onClick={() => setSelectedUdhaar(entry)}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <History className="w-4 h-4" /> Add Payment
                            </button>
                            <button 
                              onClick={() => toggleSettle(entry.id, entry.isSettled)}
                              className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Settle All
                            </button>
                          </div>
                        )}

                        {/* Payment History Preview */}
                        {(entry.payments?.length ?? 0) > 0 && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {entry.payments.map((p) => (
                              <div key={p.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                Rs. {p.amount} on {new Date(p.date).toLocaleDateString()}
                              </div>
                            ))}
                          </div>
                        )}
                        
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FAB to add entries */}
      <div className="fixed bottom-6 right-6 z-40">
        <button className="bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-transform hover:scale-105">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Payment Modal */}
      {selectedUdhaar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Payment</h3>
              <button onClick={() => setSelectedUdhaar(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Recording payment for <span className="font-semibold text-gray-700">{selectedUdhaar.personName}</span>. 
              Remaining: <span className="font-semibold">Rs. {getRemainingAmount(selectedUdhaar)}</span>
            </p>

            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount Paid (Rs.)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button 
              onClick={handleAddPayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
              Save Payment
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
