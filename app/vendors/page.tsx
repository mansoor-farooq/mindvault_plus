'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PurchaseItem } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, Truck, Plus, Search, Building2, Phone, ReceiptText, ArrowDownLeft, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function VendorsPage() {
  const [activeTab, setActiveTab] = useState<'VENDORS' | 'PURCHASES'>('VENDORS');
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddPO, setShowAddPO] = useState(false);

  // Forms
  const [vName, setVName] = useState('');
  const [vCompany, setVCompany] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vBalance, setVBalance] = useState('');

  // PO Form
  const [poVendor, setPoVendor] = useState('');
  const [poItems, setPoItems] = useState<PurchaseItem[]>([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const [poPaid, setPoPaid] = useState('');

  const vendors = useLiveQuery(() => db.vendors.reverse().toArray(), []) || [];
  const purchases = useLiveQuery(() => db.purchaseOrders.reverse().toArray(), []) || [];

  const vendorBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    vendors.forEach(v => {
      balances[v.syncId!] = Number(v.openingBalance || 0);
    });
    purchases.forEach(p => {
      if (balances[p.vendorId] !== undefined) {
        const pendingAmount = p.totalAmount - p.amountPaid;
        balances[p.vendorId] += pendingAmount;
      }
    });
    return balances;
  }, [vendors, purchases]);

  const handleAddVendor = async () => {
    if (!vName) return;
    await db.vendors.add({
      syncId: crypto.randomUUID(),
      name: vName,
      companyName: vCompany,
      phone: vPhone,
      openingBalance: Number(vBalance) || 0,
      createdAt: new Date()
    });
    SyncService.sync();
    setShowAddVendor(false);
    setVName(''); setVCompany(''); setVPhone(''); setVBalance('');
  };

  const handlePOItemChange = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...poItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = Number(newItems[index].quantity || 0) * Number(newItems[index].unitPrice || 0);
    }
    setPoItems(newItems);
  };

  const addPOItemRow = () => {
    setPoItems([...poItems, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleSavePO = async () => {
    if (!poVendor || poItems.length === 0) return;
    const totalAmount = poItems.reduce((sum, item) => sum + item.total, 0);
    
    await db.purchaseOrders.add({
      syncId: crypto.randomUUID(),
      vendorId: poVendor,
      poNumber: \PO-\\,
      date: new Date(),
      items: poItems,
      totalAmount,
      amountPaid: Number(poPaid) || 0,
      status: 'COMPLETED',
      createdAt: new Date()
    });
    
    SyncService.sync();
    setShowAddPO(false);
    setPoVendor('');
    setPoPaid('');
    setPoItems([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const totalMarketPayables = Object.values(vendorBalances).reduce((sum, bal) => sum + bal, 0);

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" /> Suppliers & Purchases
          </h1>
        </div>
      </header>

      <div className="bg-white px-4 flex gap-4 border-b border-slate-200 sticky top-[73px] z-10">
        <button onClick={() => setActiveTab('VENDORS')} className={\py-4 font-bold text-sm border-b-2 transition-colors \\}>Vendors</button>
        <button onClick={() => setActiveTab('PURCHASES')} className={\py-4 font-bold text-sm border-b-2 transition-colors \\}>Purchase Orders</button>
      </div>

      <div className="p-4 lg:p-8 max-w-5xl w-full mx-auto flex flex-col gap-6">
        
        {/* KPI Banner */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex justify-between items-center">
          <div>
            <p className="text-indigo-200 font-bold uppercase tracking-wider text-xs mb-1">Total Market Payables</p>
            <p className="text-3xl font-black text-rose-400">Rs {totalMarketPayables.toLocaleString()}</p>
            <p className="text-xs text-indigo-300 mt-1">Amount you owe to your suppliers</p>
          </div>
          <Truck className="w-12 h-12 text-indigo-700/50" />
        </div>

        {/* VENDORS TAB */}
        {activeTab === 'VENDORS' && (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700">Vendor Directory</h2>
              <button onClick={() => setShowAddVendor(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200">
                <Plus className="w-4 h-4" /> Add Vendor
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendors.length === 0 ? (
                <div className="col-span-1 md:col-span-2 text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No vendors found. Add the wholesalers you purchase from.</p>
                </div>
              ) : (
                vendors.map(v => (
                  <div key={v.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-shadow">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{v.name}</h3>
                      <p className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-lg inline-block mt-1">{v.companyName || 'Independent'}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-2"><Phone className="w-3 h-3" /> {v.phone || 'No phone'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Payable Balance</p>
                      <p className={\ont-black text-lg \\}>
                        Rs {vendorBalances[v.syncId!].toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PURCHASES TAB */}
        {activeTab === 'PURCHASES' && (
          <div className="flex flex-col gap-4 animate-in fade-in">
             <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700">Purchase Orders</h2>
              <button onClick={() => setShowAddPO(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200">
                <Plus className="w-4 h-4" /> New Purchase
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {purchases.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
                  <ReceiptText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No purchases recorded. Buy stock to see it here.</p>
                </div>
              ) : (
                purchases.map(p => {
                  const v = vendors.find(ven => ven.syncId === p.vendorId);
                  const pending = p.totalAmount - p.amountPaid;
                  return (
                    <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{p.poNumber}</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(p.date).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-slate-800">{v?.name || 'Unknown Vendor'}</h3>
                        <p className="text-xs text-slate-500 mt-1">{p.items.length} items purchased</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400">Total Bill</p>
                          <p className="font-bold text-slate-700">Rs {p.totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400">Paid Now</p>
                          <p className="font-bold text-emerald-600">Rs {p.amountPaid.toLocaleString()}</p>
                        </div>
                        <div className="text-right bg-rose-50 p-2 rounded-xl border border-rose-100 min-w-[100px]">
                          <p className="text-xs font-bold text-rose-500">Added to Udhaar</p>
                          <p className="font-black text-rose-700">Rs {pending.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Vendor Modal */}
      {showAddVendor && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" /> Add Supplier
            </h2>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Contact Name</label>
              <input type="text" value={vName} onChange={e => setVName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Company / Shop Name</label>
              <input type="text" value={vCompany} onChange={e => setVCompany(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Phone</label>
              <input type="text" value={vPhone} onChange={e => setVPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Previous Balance (You owe them)</label>
              <input type="number" value={vBalance} onChange={e => setVBalance(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none" />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowAddVendor(false)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleAddVendor} className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl">Save Vendor</button>
            </div>
          </div>
        </div>
      )}

      {/* Add PO Modal */}
      {showAddPO && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ReceiptText className="w-6 h-6 text-indigo-600" /> Record Purchase
            </h2>
            
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Select Supplier</label>
              <select value={poVendor} onChange={e => setPoVendor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none">
                <option value="">-- Choose Vendor --</option>
                {vendors.map(v => <option key={v.id} value={v.syncId}>{v.name} ({v.companyName})</option>)}
              </select>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold text-slate-500">Items Purchased</label>
                <button onClick={addPOItemRow} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus className="w-3 h-3"/> Add Row</button>
              </div>
              
              <div className="flex flex-col gap-2">
                {poItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input type="text" placeholder="Desc" value={item.description} onChange={e => handlePOItemChange(idx, 'description', e.target.value)} className="flex-1 p-2 border rounded-lg text-sm" />
                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handlePOItemChange(idx, 'quantity', e.target.value)} className="w-20 p-2 border rounded-lg text-sm" />
                    <input type="number" placeholder="Price" value={item.unitPrice} onChange={e => handlePOItemChange(idx, 'unitPrice', e.target.value)} className="w-24 p-2 border rounded-lg text-sm" />
                    <div className="w-24 font-bold text-slate-700 text-right text-sm">Rs {item.total}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-rose-500 mb-1">Total Bill Amount</p>
                <p className="text-2xl font-black text-rose-700">Rs {poItems.reduce((s, i) => s + i.total, 0).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-rose-500 mb-1 block">Amount Paid Right Now</label>
                <input type="number" value={poPaid} onChange={e => setPoPaid(e.target.value)} placeholder="0" className="w-full bg-white border border-rose-200 text-rose-700 font-bold rounded-xl p-3 outline-none focus:border-rose-500" />
                <p className="text-[10px] text-rose-400 mt-1">Remaining amount will add to vendor balance</p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddPO(false)} className="flex-1 py-4 font-bold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleSavePO} className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-xl">Save Purchase</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
