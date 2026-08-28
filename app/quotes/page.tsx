'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, KhataCustomer } from '@/lib/db';
import { ArrowLeft, Search, ShoppingCart, Trash2, Printer, Sparkles, FileText, Package } from 'lucide-react';
import Link from 'next/link';

export default function QuoteBuilderPage() {
  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray(), []) || [];
  const customers = useLiveQuery(() => db.khataCustomers.filter(c => !c.isDeleted).toArray(), []) || [];

  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Print Mode State
  const [isPrinting, setIsPrinting] = useState(false);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(0, subtotal - discount);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.syncId);
      if (existing) {
        return prev.map(i => i.productId === product.syncId 
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice } 
          : i);
      }
      return [...prev, {
        productId: product.syncId!,
        name: product.name,
        quantity: 1,
        unitPrice: Number(product.price) || 0,
        total: Number(product.price) || 0
      }];
    });
    setSearchQuery('');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const handlePrintQuote = () => {
    if (cart.length === 0) return;
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const customer = customers.find(c => c.syncId === selectedCustomerId);
  const quoteNumber = \EST-\\;

  return (
    <main className="flex-1 flex flex-col bg-slate-950 min-h-screen text-slate-200 print:bg-white print:text-black">
      
      {/* HEADER - Hidden in Print */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-700 text-white p-4 shadow-2xl sticky top-0 z-10 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-amber-200" />
          </Link>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-200" /> Takhmeena (Estimate Builder)
          </h1>
        </div>
      </header>

      {/* BUILDER UI - Hidden in Print */}
      {!isPrinting && (
        <div className="p-4 max-w-4xl w-full mx-auto flex flex-col gap-6 mt-4 print:hidden">
          <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800">
            
            <div className="bg-amber-900/30 border border-amber-500/30 text-amber-200 p-4 rounded-xl mb-6 flex gap-3 items-center">
              <Sparkles className="w-6 h-6 shrink-0" />
              <p className="text-sm">Estimates generated here <b>do not</b> affect your inventory, revenue, or Khata. They are strictly for quoting prices to customers.</p>
            </div>

            {/* Product Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search inventory to add to quote..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white focus:border-amber-500 outline-none transition-colors"
              />
              
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-20">
                  {filteredProducts.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-0 flex justify-between items-center"
                    >
                      <span className="font-semibold text-white">{p.name}</span>
                      <span className="text-amber-400 font-bold">Rs {p.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="flex flex-col gap-2 min-h-[150px] mb-6">
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                  <Package className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">Quote is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.quantity} x Rs {item.unitPrice}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-amber-400">Rs {item.total}</p>
                      <button onClick={() => removeFromCart(item.productId)} className="text-rose-500 hover:bg-rose-500/20 p-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer & Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Quote For (Customer)</label>
                <select 
                  value={selectedCustomerId} 
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none"
                >
                  <option value="">Walk-in / Unknown</option>
                  {customers.map(c => <option key={c.id} value={c.syncId}>{c.name}</option>)}
                </select>
                
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1 mt-4">Discount (Rs)</label>
                <input 
                  type="number" 
                  value={discount} 
                  onChange={e => setDiscount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 border border-amber-500/30 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2 text-sm text-slate-300">
                    <span>Subtotal</span><span>Rs {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-amber-500/30 pt-4 mb-4">
                    <span className="font-bold text-white text-lg">Total Estimate</span>
                    <span className="font-black text-2xl text-amber-400">Rs {finalTotal.toLocaleString()}</span>
                  </div>
                </div>

                <button 
                  onClick={handlePrintQuote}
                  disabled={cart.length === 0}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(217,119,6,0.3)] hover:shadow-[0_0_30px_rgba(217,119,6,0.5)] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <Printer className="w-6 h-6" /> PRINT QUOTATION
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PRINT LAYOUT (Only visible when printing) */}
      <div className="hidden print:block w-full max-w-2xl mx-auto p-10 bg-white text-black">
        <div className="flex justify-between items-start border-b-2 border-slate-200 pb-8 mb-8">
          <div>
            <div className="flex items-center gap-2 text-slate-800 mb-2">
              <h1 className="text-3xl font-black tracking-tighter">MindVault.</h1>
            </div>
            <p className="text-slate-500 text-sm">123 Business Street, Tech City</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-slate-300 uppercase tracking-widest mb-2">Quotation</h2>
            <p className="text-slate-800 font-bold">#{quoteNumber}</p>
            <p className="text-slate-500 text-sm">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Estimate For</p>
          <p className="text-lg font-bold text-slate-800">{customer ? customer.name : 'Walk-in Customer'}</p>
        </div>

        <table className="w-full text-left mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800 text-slate-800">
              <th className="py-3 font-bold uppercase text-xs tracking-wider">Item Description</th>
              <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Qty</th>
              <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Unit Price</th>
              <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Total</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {cart.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-4 font-semibold">{item.name}</td>
                <td className="py-4 text-center">{item.quantity}</td>
                <td className="py-4 text-right">Rs {item.unitPrice.toLocaleString()}</td>
                <td className="py-4 text-right font-bold">Rs {item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-1/2 min-w-[250px]">
            <div className="flex justify-between py-2 text-slate-600">
              <span>Subtotal</span>
              <span>Rs {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-2 text-slate-600">
                <span>Discount</span>
                <span>- Rs {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-4 mt-2 border-t-2 border-slate-800 text-xl font-black text-black">
              <span>Total Estimate</span>
              <span>Rs {finalTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-500 text-sm">
          <p className="font-bold mb-1">This is a quotation, not an invoice.</p>
          <p>Prices are subject to change. Valid for 7 days.</p>
        </div>
      </div>
    </main>
  );
}
