"use client";

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { ArrowLeft, Trash2, RefreshCcw, Search, Wallet, Receipt, Users, Store } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function TrashPage() {
  const [filter, setFilter] = useState<'ALL' | 'NOTES' | 'LEDGER' | 'UDHAAR' | 'BILLS' | 'KHATA'>('ALL');

  // Fetch deleted items
  const deletedNotes = useLiveQuery(() => db.notes.filter(note => !!note.isDeleted).reverse().sortBy('deletedAt')) || [];
  const deletedLedger = useLiveQuery(() => db.ledgerEntries.filter(e => !!e.isDeleted).reverse().sortBy('deletedAt')) || [];
  const deletedUdhaar = useLiveQuery(() => db.udhaar.filter(e => !!e.isDeleted).reverse().sortBy('deletedAt')) || [];
  const deletedBills = useLiveQuery(() => db.bills.filter(e => !!e.isDeleted).reverse().sortBy('deletedAt')) || [];
  const deletedKhataCustomers = useLiveQuery(() => db.khataCustomers.filter(e => !!e.isDeleted).reverse().sortBy('deletedAt')) || [];
  const deletedKhataTransactions = useLiveQuery(() => db.khataTransactions.filter(e => !!e.isDeleted).reverse().sortBy('deletedAt')) || [];

  const restoreItem = async (type: 'NOTE' | 'LEDGER' | 'UDHAAR' | 'BILL' | 'KHATA_CUSTOMER' | 'KHATA_TXN', id: number | string) => {
    if (type === 'NOTE') {
      await db.notes.update(id as number, { isDeleted: false, deletedAt: undefined, updatedAt: new Date() });
    } else if (type === 'LEDGER') {
      await db.ledgerEntries.update(id as number, { isDeleted: false, deletedAt: undefined, updatedAt: new Date() });
    } else if (type === 'UDHAAR') {
      await db.udhaar.update(id as number, { isDeleted: false, deletedAt: undefined, updatedAt: new Date() });
    } else if (type === 'BILL') {
      await db.bills.update(id as string, { isDeleted: false, deletedAt: undefined, updatedAt: new Date() });
    } else if (type === 'KHATA_CUSTOMER') {
      await db.khataCustomers.update(id as number, { isDeleted: false, deletedAt: undefined, updatedAt: new Date() });
    } else if (type === 'KHATA_TXN') {
      await db.khataTransactions.update(id as number, { isDeleted: false, deletedAt: undefined, updatedAt: new Date() });
    }
  };

  const getFilteredItems = () => {
    let items: any[] = [];
    if (filter === 'ALL' || filter === 'NOTES') {
      items = [...items, ...deletedNotes.map(n => ({ ...n, itemType: 'NOTE' }))];
    }
    if (filter === 'ALL' || filter === 'LEDGER') {
      items = [...items, ...deletedLedger.map(l => ({ ...l, itemType: 'LEDGER' }))];
    }
    if (filter === 'ALL' || filter === 'UDHAAR') {
      items = [...items, ...deletedUdhaar.map(u => ({ ...u, itemType: 'UDHAAR' }))];
    }
    if (filter === 'ALL' || filter === 'BILLS') {
      items = [...items, ...deletedBills.map(b => ({ ...b, itemType: 'BILL' }))];
    }
    if (filter === 'ALL' || filter === 'KHATA') {
      items = [...items, ...deletedKhataCustomers.map(kc => ({ ...kc, itemType: 'KHATA_CUSTOMER' }))];
      items = [...items, ...deletedKhataTransactions.map(kt => ({ ...kt, itemType: 'KHATA_TXN' }))];
    }
    return items.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
  };

  const items = getFilteredItems();

  return (
    <main className="flex-1 flex flex-col bg-gray-50 h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide">Trash (Recycle Bin)</h1>
        </div>
      </header>

      <div className="flex bg-white shadow-sm sticky top-[68px] z-10 overflow-x-auto scrollbar-hide">
        {['ALL', 'NOTES', 'LEDGER', 'UDHAAR', 'BILLS', 'KHATA'].map((f) => (
          <button 
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-3 font-medium text-sm text-center border-b-2 whitespace-nowrap transition-colors ${filter === f ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex items-start gap-3">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 mt-0.5">
            <Trash2 className="w-4 h-4" />
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">
            Items here are soft-deleted and will not appear in your main dashboard or searches. 
            <br/><span className="font-semibold">Note:</span> Permanent deletion is disabled by system policy to ensure you never lose your data.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-gray-400 mt-20 animate-fade-in-up">
            <div className="bg-gray-100 p-6 rounded-full mb-4">
              <Trash2 className="w-12 h-12 text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-600 mb-2">Trash is empty</p>
            <p className="text-sm">No deleted items found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={`${item.itemType}-${item.id}-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-red-50 flex items-center justify-between gap-3 animate-fade-in-up">
                <div className="flex items-center gap-3 flex-1 min-w-0 opacity-70">
                  <div className="p-3 bg-red-50 text-red-500 rounded-full shrink-0">
                    {item.itemType === 'NOTE' ? <Search className="w-5 h-5" /> :
                     item.itemType === 'LEDGER' ? <Wallet className="w-5 h-5" /> :
                     item.itemType === 'UDHAAR' ? <Users className="w-5 h-5" /> :
                     (item.itemType === 'KHATA_CUSTOMER' || item.itemType === 'KHATA_TXN') ? <Store className="w-5 h-5" /> :
                     <Receipt className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {item.itemType === 'NOTE' ? item.title || 'Untitled Note' :
                       item.itemType === 'LEDGER' ? `${item.category} (Rs. ${item.amount})` :
                       item.itemType === 'UDHAAR' ? `Udhaar: ${item.personName} (Rs. ${item.amount})` :
                       item.itemType === 'KHATA_CUSTOMER' ? `Khata Customer: ${item.name}` :
                       item.itemType === 'KHATA_TXN' ? `Khata Txn (Rs. ${item.amount})` :
                       item.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-1 mb-1">
                      {item.itemType === 'NOTE' ? item.description :
                       item.itemType === 'LEDGER' ? item.note || 'No note' :
                       item.itemType === 'UDHAAR' ? item.type :
                       item.itemType === 'KHATA_CUSTOMER' ? item.phone :
                       item.itemType === 'KHATA_TXN' ? item.note :
                       item.category}
                    </p>
                    <p className="text-xs text-red-400 font-medium">
                      Deleted on {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => restoreItem(item.itemType, item.id)}
                  className="shrink-0 flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg font-medium text-sm hover:bg-indigo-100 transition-colors"
                >
                  <RefreshCcw className="w-4 h-4" /> Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
