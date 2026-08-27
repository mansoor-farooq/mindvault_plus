"use client";

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Udhaar, UdhaarPayment, Bill } from '@/lib/db';
import { suggestExpenseCategory } from '@/lib/smartSuggestions';
import { ArrowLeft, Plus, Wallet, ArrowUpRight, ArrowDownRight, Users, CheckCircle2, History, X, Receipt, Calendar, Phone, Mail, LogOut, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import BannedScreen from '@/components/BannedScreen';

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'UDHAAR' | 'BILLS'>('LEDGER');
  const [selectedUdhaar, setSelectedUdhaar] = useState<Udhaar | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentProofBlob, setPaymentProofBlob] = useState<Blob | null>(null);
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'LEDGER' | 'UDHAAR' | 'BILLS'>('LEDGER');
  const [ledgerData, setLedgerData] = useState({ type: 'EXPENSE' as 'INCOME'|'EXPENSE', amount: '', category: '', note: '', date: new Date().toISOString().split('T')[0], attachedPhotoBlob: null as Blob | null });
  const [udhaarData, setUdhaarData] = useState({ type: 'TO_GIVE' as 'TO_GIVE'|'TO_RECEIVE', personName: '', amount: '', dueDate: '' });
  const [billData, setBillData] = useState({ title: '', amount: '', dueDate: new Date().toISOString().split('T')[0], category: 'Utilities', note: '' });

  const suggestedLedgerCategory = useMemo(() => {
    if (ledgerData.type !== 'EXPENSE' || ledgerData.category.trim()) return null;
    return suggestExpenseCategory(ledgerData.note);
  }, [ledgerData.type, ledgerData.category, ledgerData.note]);

  // Fetch Data
  const ledgerEntries = useLiveQuery(() => db.ledgerEntries.filter(e => !e.isDeleted).reverse().sortBy('date')) || [];
  const udhaarEntries = useLiveQuery(() => db.udhaar.filter(e => !e.isDeleted).reverse().sortBy('createdAt')) || [];
  const billsEntries = useLiveQuery(() => db.bills.filter(b => !b.isDeleted).reverse().sortBy('createdAt')) || [];

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
      await db.udhaar.update(id, { isSettled: !currentStatus, updatedAt: new Date() });
    }
  };

  const handleAddPayment = async () => {
    if (!selectedUdhaar || !selectedUdhaar.id || !paymentAmount) return;
    
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const newPayment: UdhaarPayment = {
      id: Date.now().toString(),
      amount: amountNum,
      date: new Date(paymentDate),
      note: paymentNote || undefined,
      proofBlob: paymentProofBlob || undefined,
    };

    const updatedPayments = [...(selectedUdhaar.payments || []), newPayment];
    const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const isSettled = totalPaid >= selectedUdhaar.amount;

    await db.udhaar.update(selectedUdhaar.id, {
      payments: updatedPayments,
      isSettled: isSettled || selectedUdhaar.isSettled,
      updatedAt: new Date()
    });

    setSelectedUdhaar(null);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote('');
    setPaymentProofBlob(null);
  };

  const handleMarkBillPaid = async (bill: Bill) => {
    await db.bills.update(bill.id!, {
      isPaid: true,
      updatedAt: new Date()
    });
    // Auto add to ledger
    await db.ledgerEntries.add({
      id: Date.now().toString() as any,
      type: 'EXPENSE',
      amount: bill.amount,
      category: bill.category || 'Bill',
      note: `Paid Bill: ${bill.title}`,
      date: new Date(),
      isRecurring: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });
  };

  const handleSoftDelete = async (type: 'LEDGER' | 'UDHAAR' | 'BILLS', id: number | string) => {
    if (confirm('Are you sure you want to delete this item? It will be moved to Trash.')) {
      if (type === 'LEDGER') {
        await db.ledgerEntries.update(id as number, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
      } else if (type === 'UDHAAR') {
        await db.udhaar.update(id as number, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
      } else if (type === 'BILLS') {
        await db.bills.update(id as string, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createType === 'LEDGER') {
      const amountNum = parseFloat(ledgerData.amount);
      if (isNaN(amountNum) || amountNum <= 0) return;
      await db.ledgerEntries.add({
        type: ledgerData.type,
        amount: amountNum,
        category: ledgerData.category,
        note: ledgerData.note || undefined,
        date: ledgerData.date ? new Date(ledgerData.date) : new Date(),
        attachedPhotoBlob: ledgerData.attachedPhotoBlob || undefined,
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false
      });
      setLedgerData({ type: 'EXPENSE', amount: '', category: '', note: '', date: new Date().toISOString().split('T')[0], attachedPhotoBlob: null });
    } else if (createType === 'UDHAAR') {
      const amountNum = parseFloat(udhaarData.amount);
      if (isNaN(amountNum) || amountNum <= 0) return;
      await db.udhaar.add({
        type: udhaarData.type,
        personName: udhaarData.personName,
        amount: amountNum,
        dueDate: udhaarData.dueDate ? new Date(udhaarData.dueDate) : undefined,
        isSettled: false,
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false
      });
      setUdhaarData({ type: 'TO_GIVE', personName: '', amount: '', dueDate: '' });
    } else if (createType === 'BILLS') {
      const amountNum = parseFloat(billData.amount);
      if (isNaN(amountNum) || amountNum <= 0) return;
      await db.bills.add({
        id: Date.now().toString(),
        title: billData.title,
        amount: amountNum,
        dueDate: new Date(billData.dueDate),
        isPaid: false,
        category: billData.category,
        note: billData.note,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false
      });
      setBillData({ title: '', amount: '', dueDate: new Date().toISOString().split('T')[0], category: 'Utilities', note: '' });
    }
    setIsCreateModalOpen(false);
  };

  const { user, logout } = useAuthStore();

  if (user?.status === 'BANNED') {
    return <BannedScreen />;
  }

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
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
        <button 
          onClick={() => setActiveTab('BILLS')}
          className={`flex-1 p-4 font-medium text-center border-b-2 transition-colors ${activeTab === 'BILLS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}
        >
          Bills
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
                          <p className="font-semibold text-gray-900 flex items-center gap-2">
                            {entry.category}
                            {entry.attachedPhotoBlob && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Photo</span>}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString()} {entry.note && `• ${entry.note}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-bold ${entry.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                          {entry.type === 'INCOME' ? '+' : '-'} Rs. {entry.amount}
                        </p>
                        <button onClick={() => handleSoftDelete('LEDGER', entry.id!)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'UDHAAR' ? (
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
                          <div className="text-right flex flex-col items-end gap-2">
                            <div>
                              <p className="text-xs text-gray-400 line-through">Rs. {entry.amount}</p>
                              <p className={`font-bold ${entry.isSettled ? 'text-gray-400' : entry.type === 'TO_GIVE' ? 'text-red-600' : 'text-green-600'}`}>
                                Rs. {remaining}
                              </p>
                            </div>
                            <button onClick={() => handleSoftDelete('UDHAAR', entry.id!)} className="text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                              <div key={p.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                                <span>Rs. {p.amount} on {new Date(p.date).toLocaleDateString()}</span>
                                {p.proofBlob && (
                                  <span className="text-indigo-500 font-medium">(Proof)</span>
                                )}
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
        ) : activeTab === 'BILLS' ? (
          <div className="space-y-6 animate-fade-in-up">
            <h3 className="font-bold text-gray-800 mb-4 px-1">Upcoming Bills & Payables</h3>
            {billsEntries.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">No bills added yet</div>
            ) : (
              <div className="space-y-4">
                {billsEntries.map(bill => (
                  <div key={bill.id} className={`bg-white p-4 rounded-xl shadow-sm border ${bill.isPaid ? 'opacity-60 border-gray-100' : 'border-orange-50'} flex flex-col gap-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${bill.isPaid ? 'bg-gray-50 text-gray-500' : 'bg-orange-50 text-orange-500'}`}>
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-semibold ${bill.isPaid ? 'line-through text-gray-500' : 'text-gray-900'}`}>{bill.title}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> 
                            Due: {new Date(bill.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div>
                          <p className={`font-bold ${bill.isPaid ? 'text-gray-400' : 'text-orange-600'}`}>
                            Rs. {bill.amount}
                          </p>
                          <p className="text-xs text-gray-400">{bill.category}</p>
                        </div>
                        <button onClick={() => handleSoftDelete('BILLS', bill.id!)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {!bill.isPaid && (
                      <div className="flex justify-end mt-2 pt-3 border-t border-gray-50">
                        <button 
                          onClick={() => handleMarkBillPaid(bill)}
                          className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Mark as Paid
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* FAB to add entries */}
      <div className="fixed bottom-6 right-6 z-40">
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-transform hover:scale-105"
        >
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

            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount Paid (Rs.)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="E.g., Bank transfer, Cash"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Proof (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPaymentProofBlob(file);
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
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

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create New Entry</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
              <button 
                onClick={() => setCreateType('LEDGER')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${createType === 'LEDGER' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                Ledger
              </button>
              <button 
                onClick={() => setCreateType('UDHAAR')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${createType === 'UDHAAR' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                Udhaar
              </button>
              <button 
                onClick={() => setCreateType('BILLS')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${createType === 'BILLS' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                Bills
              </button>
            </div>

            <form onSubmit={handleCreate}>
              {createType === 'LEDGER' && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Transaction Type</label>
                    <select 
                      value={ledgerData.type} 
                      onChange={e => setLedgerData({...ledgerData, type: e.target.value as 'INCOME' | 'EXPENSE'})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="INCOME">Income (Earnings)</option>
                      <option value="EXPENSE">Expense (Spending)</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount (Rs.)</label>
                    <input 
                      type="number" required min="1"
                      value={ledgerData.amount}
                      onChange={e => setLedgerData({...ledgerData, amount: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category (e.g. Salary, Food)</label>
                    <input
                      type="text" required
                      value={ledgerData.category}
                      onChange={e => setLedgerData({...ledgerData, category: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {suggestedLedgerCategory && (
                      <button
                        type="button"
                        onClick={() => setLedgerData({ ...ledgerData, category: suggestedLedgerCategory })}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-1 hover:bg-indigo-100"
                      >
                        Suggested: {suggestedLedgerCategory}
                      </button>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                    <input 
                      type="date" required
                      value={ledgerData.date}
                      onChange={e => setLedgerData({...ledgerData, date: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Note (Optional)</label>
                    <textarea 
                      value={ledgerData.note}
                      onChange={e => setLedgerData({...ledgerData, note: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={2}
                    ></textarea>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Attach Photo (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setLedgerData({...ledgerData, attachedPhotoBlob: file});
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </>
              )}
              
              {createType === 'UDHAAR' && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Udhaar Type</label>
                    <select 
                      value={udhaarData.type} 
                      onChange={e => setUdhaarData({...udhaarData, type: e.target.value as 'TO_GIVE' | 'TO_RECEIVE'})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="TO_GIVE">I have to Give (Borrowed)</option>
                      <option value="TO_RECEIVE">I will Receive (Lent)</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Person Name</label>
                    <input 
                      type="text" required
                      value={udhaarData.personName}
                      onChange={e => setUdhaarData({...udhaarData, personName: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total Amount (Rs.)</label>
                    <input 
                      type="number" required min="1"
                      value={udhaarData.amount}
                      onChange={e => setUdhaarData({...udhaarData, amount: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Due Date (Optional)</label>
                    <input 
                      type="date"
                      value={udhaarData.dueDate}
                      onChange={e => setUdhaarData({...udhaarData, dueDate: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}
              
              {createType === 'BILLS' && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Bill Title</label>
                    <input 
                      type="text" required
                      value={billData.title}
                      onChange={e => setBillData({...billData, title: e.target.value})}
                      placeholder="e.g. Electric Bill"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount (Rs.)</label>
                    <input 
                      type="number" required min="1"
                      value={billData.amount}
                      onChange={e => setBillData({...billData, amount: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                    <input 
                      type="date" required
                      value={billData.dueDate}
                      onChange={e => setBillData({...billData, dueDate: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <input 
                      type="text" required
                      value={billData.category}
                      onChange={e => setBillData({...billData, category: e.target.value})}
                      placeholder="e.g. Utilities"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Note (Optional)</label>
                    <textarea 
                      value={billData.note}
                      onChange={e => setBillData({...billData, note: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={2}
                    ></textarea>
                  </div>
                </>
              )}

              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl mt-2 hover:bg-indigo-700 transition-colors"
              >
                Save Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
