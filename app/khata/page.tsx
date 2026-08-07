"use client";

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, KhataCustomer, KhataTransaction } from '@/lib/db';
import { ArrowLeft, Plus, User as UserIcon, Phone, MapPin, Search, MessageCircle, ArrowUpRight, ArrowDownLeft, X, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function KhataPage() {
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'TRANSACTIONS'>('CUSTOMERS');
  const [selectedCustomer, setSelectedCustomer] = useState<KhataCustomer | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddTxnOpen, setIsAddTxnOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  const [txnAmount, setTxnAmount] = useState('');
  const [txnNote, setTxnNote] = useState('');
  const [txnType, setTxnType] = useState<'CREDIT' | 'DEBIT'>('CREDIT'); // CREDIT = You gave goods/money (They owe you), DEBIT = You received payment (They paid you)

  const customers = useLiveQuery(() => db.khataCustomers.filter(c => !c.isDeleted).toArray());
  const transactions = useLiveQuery(() => db.khataTransactions.filter(t => !t.isDeleted).toArray());

  const customerBalances = useMemo(() => {
    if (!customers || !transactions) return {};
    const balances: Record<string, number> = {};
    customers.forEach(c => balances[c.syncId!] = 0);
    transactions.forEach(t => {
      if (balances[t.customerId] !== undefined) {
        if (t.type === 'CREDIT') balances[t.customerId] += Number(t.amount); // They owe
        if (t.type === 'DEBIT') balances[t.customerId] -= Number(t.amount); // They paid
      }
    });
    return balances;
  }, [customers, transactions]);

  const totalMarketCredit = useMemo(() => {
    return Object.values(customerBalances).reduce((acc, bal) => bal > 0 ? acc + bal : acc, 0);
  }, [customerBalances]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchQuery) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone?.includes(searchQuery));
  }, [customers, searchQuery]);

  const customerTxns = useMemo(() => {
    if (!selectedCustomer || !transactions) return [];
    return transactions.filter(t => t.customerId === selectedCustomer.syncId).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [selectedCustomer, transactions]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    await db.khataCustomers.add({
      name,
      phone,
      address,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });
    
    setName(''); setPhone(''); setAddress('');
    setIsAddCustomerOpen(false);
  };

  const handleAddTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !txnAmount || isNaN(Number(txnAmount))) return;
    
    await db.khataTransactions.add({
      customerId: selectedCustomer.syncId!,
      type: txnType,
      amount: Number(txnAmount),
      note: txnNote,
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    });
    
    setTxnAmount(''); setTxnNote('');
    setIsAddTxnOpen(false);
  };

  const handleWhatsAppReminder = (customer: KhataCustomer) => {
    const balance = customerBalances[customer.syncId!];
    if (!balance || balance <= 0 || !customer.phone) {
      alert("Cannot send reminder. Check if balance is greater than 0 and phone number exists.");
      return;
    }
    const message = `Hello ${customer.name},\n\nThis is a friendly reminder for your pending Khata balance of *Rs ${balance.toLocaleString()}*.\n\nPlease clear your dues at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    const phoneNum = customer.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phoneNum}?text=${encodedMessage}`, '_blank');
  };

  return (
    <main className="flex-1 flex flex-col bg-[#F8FAFC] h-screen relative overflow-hidden">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-indigo-600 border-b border-indigo-700 shadow-lg text-white">
        <div className="flex items-center gap-4 p-4">
          <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Dukaan Khata</h1>
            <p className="text-indigo-200 text-sm font-medium">Manage Customer Ledgers</p>
          </div>
        </div>
        
        {!selectedCustomer && (
          <div className="px-6 pb-6">
            <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
              <p className="text-indigo-100 text-sm mb-1 uppercase tracking-wider font-semibold">Total Market Credit (To Receive)</p>
              <h2 className="text-3xl font-black">Rs {totalMarketCredit.toLocaleString()}</h2>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {!selectedCustomer ? (
          <div className="p-4 space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="grid gap-3">
              {filteredCustomers.map(customer => {
                const bal = customerBalances[customer.syncId!] || 0;
                return (
                  <div 
                    key={customer.id} 
                    onClick={() => setSelectedCustomer(customer)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-indigo-50 w-12 h-12 rounded-full flex items-center justify-center text-indigo-500 font-bold text-lg">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{customer.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {customer.phone || 'No phone'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${bal > 0 ? 'text-red-500' : bal < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                        Rs {Math.abs(bal).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{bal > 0 ? 'You will receive' : bal < 0 ? 'You will pay' : 'Settled'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 animate-fade-in-up">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedCustomer.name}</h2>
                  <p className="text-gray-500 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4" /> {selectedCustomer.phone || 'No phone'}
                  </p>
                  {selectedCustomer.address && (
                    <p className="text-gray-500 flex items-center gap-2 mt-1 text-sm">
                      <MapPin className="w-4 h-4" /> {selectedCustomer.address}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={async () => {
                      if(confirm('Delete customer and move to trash?')) {
                        await db.khataCustomers.update(selectedCustomer.id!, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
                        setSelectedCustomer(null);
                      }
                    }}
                    className="bg-red-50 text-red-500 p-2 rounded-full hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setSelectedCustomer(null)}
                    className="bg-gray-100 text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Net Balance</p>
                  <p className={`text-xl font-bold ${(customerBalances[selectedCustomer.syncId!] || 0) > 0 ? 'text-red-500' : 'text-gray-800'}`}>
                    Rs {Math.abs(customerBalances[selectedCustomer.syncId!] || 0).toLocaleString()}
                  </p>
                </div>
                {selectedCustomer.phone && (customerBalances[selectedCustomer.syncId!] || 0) > 0 && (
                  <button 
                    onClick={() => handleWhatsAppReminder(selectedCustomer)}
                    className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-100 hover:bg-green-100 transition-colors flex items-center justify-center flex-col gap-1"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-xs font-bold">Remind</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setTxnType('CREDIT'); setIsAddTxnOpen(true); }}
                  className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold text-sm border border-red-100 hover:bg-red-100 transition-colors flex justify-center items-center gap-2"
                >
                  <ArrowUpRight className="w-4 h-4" /> Gave (Credit)
                </button>
                <button 
                  onClick={() => { setTxnType('DEBIT'); setIsAddTxnOpen(true); }}
                  className="flex-1 bg-green-50 text-green-600 py-3 rounded-xl font-bold text-sm border border-green-100 hover:bg-green-100 transition-colors flex justify-center items-center gap-2"
                >
                  <ArrowDownLeft className="w-4 h-4" /> Got (Payment)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-gray-800 ml-1">Transactions</h3>
              {customerTxns.map(txn => (
                <div key={txn.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${txn.type === 'CREDIT' ? 'bg-red-500' : 'bg-green-500'}`} />
                  <div className="pl-3">
                    <p className="font-bold text-gray-800">{txn.note || (txn.type === 'CREDIT' ? 'Items given' : 'Payment received')}</p>
                    <p className="text-xs text-gray-500">{txn.date.toLocaleDateString()} • {txn.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <p className={`font-bold ${txn.type === 'CREDIT' ? 'text-red-500' : 'text-green-500'}`}>
                      {txn.type === 'CREDIT' ? '-' : '+'} Rs {txn.amount.toLocaleString()}
                    </p>
                    <button 
                      onClick={() => db.khataTransactions.update(txn.id!, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {customerTxns.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-8">No transactions yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {!selectedCustomer && (
        <div className="fixed bottom-8 right-6">
          <button 
            onClick={() => setIsAddCustomerOpen(true)}
            className="bg-gradient-to-tr from-indigo-600 to-violet-600 text-white p-4 rounded-2xl shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all"
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <form onSubmit={handleAddCustomer} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">New Customer</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Customer Name</label>
                  <input required autoFocus type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Enter name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Phone Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="WhatsApp number (e.g. +923...)" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Address (Optional)</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Shop / Home address" />
                </div>
              </div>
            </div>
            <div className="flex border-t border-gray-100">
              <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="flex-1 py-4 text-gray-500 font-semibold hover:bg-gray-50">Cancel</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100">Save Customer</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddTxnOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <form onSubmit={handleAddTxn} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className={`p-6 border-b ${txnType === 'CREDIT' ? 'bg-red-50' : 'bg-green-50'}`}>
              <h2 className={`text-xl font-bold ${txnType === 'CREDIT' ? 'text-red-700' : 'text-green-700'}`}>
                {txnType === 'CREDIT' ? 'You gave items/credit' : 'You received payment'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Amount (Rs)</label>
                <input required autoFocus type="number" step="0.01" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Details / Items</label>
                <input type="text" value={txnNote} onChange={e => setTxnNote(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder={txnType === 'CREDIT' ? 'e.g. 2 bags of flour' : 'e.g. Cash payment'} />
              </div>
            </div>
            <div className="flex border-t border-gray-100">
              <button type="button" onClick={() => setIsAddTxnOpen(false)} className="flex-1 py-4 text-gray-500 font-semibold hover:bg-gray-50">Cancel</button>
              <button type="submit" className={`flex-1 py-4 font-bold ${txnType === 'CREDIT' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}`}>Save Entry</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
