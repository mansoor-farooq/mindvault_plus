"use client";

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, KhataCustomer, KhataTransaction } from '@/lib/db';
import { 
  ArrowLeft, Plus, User as UserIcon, Phone, MapPin, Search, 
  MessageCircle, ArrowUpRight, ArrowDownLeft, X, Trash2, Printer, 
  Store, Calendar, DollarSign, Filter, CheckCircle2, AlertCircle, RefreshCw 
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export default function KhataPage() {
  const { shopModeEnabled, toggleShopMode } = useAuthStore();
  const [selectedCustomer, setSelectedCustomer] = useState<KhataCustomer | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddTxnOpen, setIsAddTxnOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'BALANCE_DESC' | 'NAME_ASC' | 'RECENT'>('BALANCE_DESC');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  
  const [txnAmount, setTxnAmount] = useState('');
  const [txnNote, setTxnNote] = useState('');
  const [txnType, setTxnType] = useState<'CREDIT' | 'DEBIT'>('CREDIT'); 
  // CREDIT = Credit Given / Udhaar Diya (Red)
  // DEBIT = Payment Received / Jama Kiye (Green)

  // Live queries from Dexie IndexedDB
  const customers = useLiveQuery(() => db.khataCustomers.filter(c => !c.isDeleted).toArray());
  const transactions = useLiveQuery(() => db.khataTransactions.filter(t => !t.isDeleted).toArray());

  // DERIVED BALANCES: openingBalance + SUM(CREDIT) - SUM(DEBIT)
  const customerBalances = useMemo(() => {
    if (!customers || !transactions) return {};
    const balances: Record<string, { currentBalance: number; totalCredit: number; totalReceived: number }> = {};
    
    customers.forEach(c => {
      if (c.syncId) {
        balances[c.syncId] = {
          currentBalance: Number(c.openingBalance || 0),
          totalCredit: 0,
          totalReceived: 0
        };
      }
    });

    transactions.forEach(t => {
      if (balances[t.customerId]) {
        const amt = Number(t.amount);
        if (t.type === 'CREDIT') {
          balances[t.customerId].currentBalance += amt;
          balances[t.customerId].totalCredit += amt;
        } else if (t.type === 'DEBIT') {
          balances[t.customerId].currentBalance -= amt;
          balances[t.customerId].totalReceived += amt;
        }
      }
    });

    return balances;
  }, [customers, transactions]);

  // DAILY SUMMARY METRICS
  const dailySummary = useMemo(() => {
    if (!transactions) return { creditToday: 0, receivedToday: 0, netToday: 0, totalMarketCredit: 0 };

    const todayStr = new Date().toISOString().split('T')[0];
    let creditToday = 0;
    let receivedToday = 0;

    transactions.forEach(t => {
      const tDateStr = new Date(t.date).toISOString().split('T')[0];
      if (tDateStr === todayStr) {
        if (t.type === 'CREDIT') creditToday += Number(t.amount);
        if (t.type === 'DEBIT') receivedToday += Number(t.amount);
      }
    });

    const totalMarketCredit = Object.values(customerBalances).reduce((sum, b) => b.currentBalance > 0 ? sum + b.currentBalance : sum, 0);

    return {
      creditToday,
      receivedToday,
      netToday: creditToday - receivedToday,
      totalMarketCredit
    };
  }, [transactions, customerBalances]);

  // SEARCH & SORTED CUSTOMERS
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    let result = customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone && c.phone.includes(searchQuery))
    );

    if (sortBy === 'BALANCE_DESC') {
      result.sort((a, b) => {
        const balA = customerBalances[a.syncId!]?.currentBalance || 0;
        const balB = customerBalances[b.syncId!]?.currentBalance || 0;
        return balB - balA;
      });
    } else if (sortBy === 'NAME_ASC') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'RECENT') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [customers, searchQuery, sortBy, customerBalances]);

  // CUSTOMER TRANSACTIONS WITH RUNNING BALANCE LEDGER
  const customerLedger = useMemo(() => {
    if (!selectedCustomer || !transactions || !selectedCustomer.syncId) return [];
    
    // Sort chronological (oldest to newest) to calculate running balance
    const rawTxns = transactions
      .filter(t => t.customerId === selectedCustomer.syncId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBal = Number(selectedCustomer.openingBalance || 0);
    const ledger = rawTxns.map(t => {
      const amt = Number(t.amount);
      if (t.type === 'CREDIT') runningBal += amt;
      else if (t.type === 'DEBIT') runningBal -= amt;

      return {
        ...t,
        runningBalance: runningBal
      };
    });

    // Reverse for UI display (newest first)
    return ledger.reverse();
  }, [selectedCustomer, transactions]);

  // HANDLERS
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await db.khataCustomers.add({
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      openingBalance: isNaN(Number(openingBalance)) ? 0 : Number(openingBalance),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });

    setName(''); setPhone(''); setAddress(''); setOpeningBalance('0');
    setIsAddCustomerOpen(false);
  };

  const handleAddTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedCustomer.syncId || !txnAmount || isNaN(Number(txnAmount))) return;

    await db.khataTransactions.add({
      customerId: selectedCustomer.syncId,
      type: txnType,
      amount: Number(txnAmount),
      note: txnNote.trim() || undefined,
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });

    setTxnAmount(''); setTxnNote('');
    setIsAddTxnOpen(false);
  };

  const handleDeleteCustomer = async (customer: KhataCustomer) => {
    if (!confirm(`Are you sure you want to delete customer "${customer.name}"?`)) return;
    if (customer.id) {
      await db.khataCustomers.update(customer.id, {
        isDeleted: true,
        deletedAt: new Date()
      });
      if (selectedCustomer?.syncId === customer.syncId) {
        setSelectedCustomer(null);
      }
    }
  };

  const handleDeleteTxn = async (txn: KhataTransaction) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    if (txn.id) {
      await db.khataTransactions.update(txn.id, {
        isDeleted: true,
        deletedAt: new Date()
      });
    }
  };

  const handleWhatsAppReminder = (customer: KhataCustomer) => {
    const balData = customerBalances[customer.syncId!];
    const balance = balData ? balData.currentBalance : 0;
    if (balance <= 0 || !customer.phone) {
      alert("Cannot send reminder. Check if balance is greater than 0 and phone number exists.");
      return;
    }
    const message = `Hello ${customer.name},\n\nThis is a friendly reminder from Dukaan Khata for your pending balance of *Rs ${balance.toLocaleString()}*.\n\nPlease clear your dues at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    const phoneNum = customer.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phoneNum}?text=${encodedMessage}`, '_blank');
  };

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 pb-24">
      {/* Header Bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
              <Store className="w-6 h-6 text-emerald-400" />
              Dukaan Khata Register
            </h1>
            <p className="text-xs text-slate-400">Digital Shop Credit & Udhaar Ledger</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleShopMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              shopModeEnabled 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Store className="w-4 h-4" />
            {shopModeEnabled ? 'Shop Mode ON' : 'Shop Mode OFF'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Daily Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium block mb-1">Total Market Credit Owed</span>
            <span className="text-2xl font-black text-rose-400">
              Rs {dailySummary.totalMarketCredit.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium block mb-1 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4 text-rose-400" /> Credit Given Today (Udhaar)
            </span>
            <span className="text-2xl font-black text-rose-400">
              Rs {dailySummary.creditToday.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium block mb-1 flex items-center gap-1">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Payment Received Today (Jama)
            </span>
            <span className="text-2xl font-black text-emerald-400">
              Rs {dailySummary.receivedToday.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium block mb-1">Net Change Today</span>
            <span className={`text-2xl font-black ${dailySummary.netToday >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              Rs {Math.abs(dailySummary.netToday).toLocaleString()} {dailySummary.netToday >= 0 ? '(Credit ↑)' : '(Received ↓)'}
            </span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Customer List */}
          <div className="lg:col-span-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col h-[650px]">
            {/* Search & Actions */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-indigo-400" /> Customers ({filteredCustomers.length})
                </h2>
                <button 
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Customer
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Search name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-xl px-2 py-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value="BALANCE_DESC">Highest Debt</option>
                  <option value="NAME_ASC">Name A-Z</option>
                  <option value="RECENT">Recently Added</option>
                </select>
              </div>
            </div>

            {/* Customers Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <UserIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No customers found.</p>
                </div>
              ) : (
                filteredCustomers.map(c => {
                  const balData = customerBalances[c.syncId!] || { currentBalance: Number(c.openingBalance || 0) };
                  const balance = balData.currentBalance;
                  const isSelected = selectedCustomer?.syncId === c.syncId;

                  return (
                    <div 
                      key={c.syncId}
                      onClick={() => setSelectedCustomer(c)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-slate-700/80 border-emerald-500/60 shadow-lg' 
                          : 'bg-slate-800/60 border-slate-700/40 hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-emerald-400 border border-slate-600">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-slate-100">{c.name}</h3>
                          {c.phone && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-sm font-bold block ${balance > 0 ? 'text-rose-400' : balance < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {balance > 0 ? `Rs ${balance.toLocaleString()} (Gives)` : balance < 0 ? `Rs ${Math.abs(balance).toLocaleString()} (Advance)` : 'Clear'}
                        </span>
                        <span className="text-[10px] text-slate-500">Derived Net Balance</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Customer Detail Running Balance Ledger */}
          <div className="lg:col-span-7 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col h-[650px]">
            {selectedCustomer ? (
              <>
                {/* Customer Detail Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-700/60 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center font-bold text-lg text-emerald-400">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedCustomer.name}</h2>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {selectedCustomer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedCustomer.phone}</span>}
                        {selectedCustomer.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedCustomer.address}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedCustomer.phone && (
                      <button 
                        onClick={() => handleWhatsAppReminder(selectedCustomer)}
                        className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-1 border border-emerald-500/30 transition-colors"
                        title="Send WhatsApp Reminder"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </button>
                    )}
                    
                    <button 
                      onClick={() => setIsPrintModalOpen(true)}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Print PDF Statement"
                    >
                      <Printer className="w-4 h-4" /> Statement
                    </button>

                    <button 
                      onClick={() => handleDeleteCustomer(selectedCustomer)}
                      className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl transition-colors"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Account Summary Banner */}
                <div className="grid grid-cols-3 gap-3 mb-4 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Opening Balance</span>
                    <span className="text-sm font-bold text-slate-300">Rs {Number(selectedCustomer.openingBalance || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Total Udhaar Given</span>
                    <span className="text-sm font-bold text-rose-400">
                      Rs {(customerBalances[selectedCustomer.syncId!]?.totalCredit || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Current Net Owed</span>
                    <span className="text-base font-black text-rose-400">
                      Rs {(customerBalances[selectedCustomer.syncId!]?.currentBalance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button 
                    onClick={() => { setTxnType('CREDIT'); setIsAddTxnOpen(true); }}
                    className="bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-600/20"
                  >
                    <ArrowUpRight className="w-4 h-4" /> + Give Credit (Udhaar Diya)
                  </button>
                  <button 
                    onClick={() => { setTxnType('DEBIT'); setIsAddTxnOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <ArrowDownLeft className="w-4 h-4" /> - Receive Payment (Jama Kiya)
                  </button>
                </div>

                {/* Running Balance Ledger List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {customerLedger.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No transactions recorded for this customer yet.</p>
                    </div>
                  ) : (
                    customerLedger.map(t => (
                      <div 
                        key={t.syncId || t.id}
                        className="bg-slate-900/60 border border-slate-700/50 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${t.type === 'CREDIT' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {t.type === 'CREDIT' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200 block">
                              {t.type === 'CREDIT' ? 'Credit Given (Udhaar)' : 'Payment Received (Jama)'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(t.date).toLocaleString()} {t.note ? `• ${t.note}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-4">
                          <div>
                            <span className={`font-bold block ${t.type === 'CREDIT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {t.type === 'CREDIT' ? `+Rs ${t.amount.toLocaleString()}` : `-Rs ${t.amount.toLocaleString()}`}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Bal: Rs {t.runningBalance.toLocaleString()}
                            </span>
                          </div>

                          <button 
                            onClick={() => handleDeleteTxn(t)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Store className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm font-semibold">Select a customer from the left to view their running khata ledger.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add Customer */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="font-bold text-base text-white">Add New Customer</h3>
              <button onClick={() => setIsAddCustomerOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Customer Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Ali Khan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Phone Number (WhatsApp)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 03001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Opening Balance (Rs)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Address / Location</label>
                <textarea 
                  rows={2}
                  placeholder="Shop # / Area..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="w-1/2 py-2 bg-slate-700 text-xs rounded-xl font-semibold text-slate-300">Cancel</button>
                <button type="submit" className="w-1/2 py-2 bg-emerald-600 text-xs rounded-xl font-semibold text-white hover:bg-emerald-500">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Transaction */}
      {isAddTxnOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="font-bold text-base text-white">
                {txnType === 'CREDIT' ? 'Give Credit (Udhaar)' : 'Receive Payment (Jama)'}
              </h3>
              <button onClick={() => setIsAddTxnOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddTxn} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Customer</label>
                <input 
                  type="text" 
                  disabled
                  value={selectedCustomer.name}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Amount (Rs) *</label>
                <input 
                  type="number" 
                  required
                  placeholder="0.00"
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Note / Description (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 2 Grocery bags..."
                  value={txnNote}
                  onChange={(e) => setTxnNote(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddTxnOpen(false)} className="w-1/2 py-2 bg-slate-700 text-xs rounded-xl font-semibold text-slate-300">Cancel</button>
                <button 
                  type="submit" 
                  className={`w-1/2 py-2 text-xs rounded-xl font-semibold text-white ${
                    txnType === 'CREDIT' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Printable View: Customer PDF Statement */}
      {isPrintModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full p-8 space-y-6 shadow-2xl relative border border-slate-200">
            <button 
              onClick={() => setIsPrintModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 p-2 print:hidden"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Printable Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Store className="w-7 h-7 text-emerald-600" /> Dukaan Khata Statement
                </h1>
                <p className="text-xs text-slate-500">Official Customer Account Ledger</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Date: {new Date().toLocaleDateString()}</p>
                <p>Time: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-700 block uppercase text-[10px]">Customer Details</span>
                <p className="text-sm font-bold text-slate-900">{selectedCustomer.name}</p>
                <p>{selectedCustomer.phone || 'No phone recorded'}</p>
                <p>{selectedCustomer.address || ''}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-700 block uppercase text-[10px]">Account Net Balance</span>
                <p className="text-xl font-black text-rose-600">
                  Rs {(customerBalances[selectedCustomer.syncId!]?.currentBalance || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500">Derived from total transactions</p>
              </div>
            </div>

            {/* Statement Table */}
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-2">Date</th>
                  <th className="py-2.5 px-2">Description</th>
                  <th className="py-2.5 px-2 text-right">Credit (+)</th>
                  <th className="py-2.5 px-2 text-right">Payment (-)</th>
                  <th className="py-2.5 px-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-slate-50/50">
                  <td className="py-2 px-2 text-slate-500">{new Date(selectedCustomer.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 px-2 font-medium text-slate-700">Opening Balance</td>
                  <td className="py-2 px-2 text-right">-</td>
                  <td className="py-2 px-2 text-right">-</td>
                  <td className="py-2 px-2 text-right font-bold text-slate-900">
                    Rs {Number(selectedCustomer.openingBalance || 0).toLocaleString()}
                  </td>
                </tr>
                {customerLedger.slice().reverse().map(t => (
                  <tr key={t.syncId || t.id}>
                    <td className="py-2 px-2 text-slate-600">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="py-2 px-2 font-medium text-slate-800">{t.note || (t.type === 'CREDIT' ? 'Credit Given' : 'Payment Received')}</td>
                    <td className="py-2 px-2 text-right font-bold text-rose-600">{t.type === 'CREDIT' ? `Rs ${t.amount.toLocaleString()}` : '-'}</td>
                    <td className="py-2 px-2 text-right font-bold text-emerald-600">{t.type === 'DEBIT' ? `Rs ${t.amount.toLocaleString()}` : '-'}</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">Rs {t.runningBalance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Print Footer & Action */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <span className="text-[10px] text-slate-400">Generated by MindVault Dukaan Khata System</span>
              <button 
                onClick={handlePrintStatement}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 print:hidden"
              >
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
