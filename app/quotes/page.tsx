'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product } from '@/lib/db';
import { ArrowLeft, Plus, Minus, Search, Trash2, Printer, FileText, Package, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface QuoteItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function QuotesPage() {
  const [cart, setCart] = useState<QuoteItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray()) || [];
  const customers = useLiveQuery(() => db.khataCustomers.filter(c => !c.isDeleted).toArray()) || [];

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);
  }, [products, searchQuery]);

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(0, subtotal - discount);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.syncId);
      if (existing) {
        return prev.map(i => i.productId === product.syncId ? {
          ...i,
          quantity: i.quantity + 1,
          total: (i.quantity + 1) * i.unitPrice
        } : i);
      }
      return [...prev, {
        productId: product.syncId!,
        name: product.name,
        quantity: 1,
        unitPrice: product.price || product.sellingPrice || 0,
        total: product.price || product.sellingPrice || 0
      }];
    });
    setSearchQuery('');
  };

  const addCustomItem = () => {
    if (!customItemName.trim() || !customItemPrice || isNaN(Number(customItemPrice))) return;
    const priceNum = Number(customItemPrice);
    setCart(prev => [
      ...prev,
      {
        productId: `custom-${Date.now()}`,
        name: customItemName.trim(),
        quantity: 1,
        unitPrice: priceNum,
        total: priceNum
      }
    ]);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const newQty = i.quantity + delta;
            if (newQty <= 0) return null;
            return { ...i, quantity: newQty, total: newQty * i.unitPrice };
          }
          return i;
        })
        .filter(Boolean) as QuoteItem[]
    );
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
  const quoteNumber = `EST-${Date.now().toString().slice(-6)}`;

  return (
    <main className="min-h-screen bg-slate-50/60 p-4 sm:p-8 pb-24 text-slate-800 print:bg-white print:p-0 print:text-black">
      
      {/* HEADER - Hidden in Print */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <Link 
            href="/" 
            className="p-2.5 bg-white rounded-2xl border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-0.5">
              <span>Workspace</span>
              <span>/</span>
              <span>Sales & Billing</span>
              <span>/</span>
              <span className="text-amber-600 font-bold">Quotes (Takhmeena)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
                <FileText className="w-6 h-6" />
              </span>
              Takhmeena Quotation Builder
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/erp" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-amber-600 shadow-sm transition"
          >
            ERP Countertop POS
          </Link>
          <Link 
            href="/inventory" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-amber-600 shadow-sm transition"
          >
            Inventory Stock
          </Link>
        </div>
      </div>

      {/* BUILDER UI - Hidden in Print */}
      {!isPrinting && (
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-6 print:hidden">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
            
            {/* Informational Alert */}
            <div className="bg-amber-50/80 border border-amber-200/80 text-amber-900 p-4 rounded-2xl mb-6 flex gap-3 items-center shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-xs sm:text-sm font-medium">
                Estimates generated here <b>do not affect your inventory stock, revenue ledger, or Khata balances</b>. They are strictly draft quotations to issue to clients before an order is placed.
              </p>
            </div>

            {/* Product Search */}
            <div className="relative mb-6">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Add Items from Inventory
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search catalog by product name or SKU..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                />
              </div>
              
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xl z-30 divide-y divide-slate-100">
                  {filteredProducts.map(p => (
                    <button 
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center transition-colors group"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800 group-hover:text-amber-600 transition-colors">{p.name}</span>
                        {p.sku && <span className="text-xs text-slate-400">SKU: {p.sku}</span>}
                      </div>
                      <span className="text-amber-600 font-black text-sm bg-amber-50 px-2.5 py-1 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all">
                        Rs {(Number(p.price) || Number(p.sellingPrice) || 0).toLocaleString()}
                      </span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      No matching products in catalog
                    </div>
                  )}
                </div>
              )}

              {/* Custom Item Adder */}
              <div className="flex flex-col sm:flex-row gap-2.5 mt-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl items-center">
                <input
                  type="text"
                  value={customItemName}
                  onChange={e => setCustomItemName(e.target.value)}
                  placeholder="Custom Item / Service (e.g. On-site Labor, Transport Delivery)..."
                  className="flex-1 w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 shadow-xs"
                />
                <input
                  type="number"
                  value={customItemPrice}
                  onChange={e => setCustomItemPrice(e.target.value)}
                  placeholder="Estimated Price (Rs)"
                  className="w-full sm:w-36 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 shadow-xs text-right"
                />
                <button
                  type="button"
                  onClick={addCustomItem}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Line Item
                </button>
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex flex-col gap-2.5 min-h-[160px] max-h-[360px] overflow-y-auto mb-6 p-1">
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12 border-2 border-dashed border-slate-200/80 rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                    <Package className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">No items added to quotation yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Select products from inventory or type a custom fee above</p>
                </div>
              ) : (
                cart.map(item => (
                  <div 
                    key={item.productId} 
                    className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl flex justify-between items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 font-medium">Rs {item.unitPrice.toLocaleString()} each</p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          title="Decrease"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-black text-slate-800 min-w-[24px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          title="Increase"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="font-black text-slate-900 text-sm min-w-[75px] text-right">
                        Rs {item.total.toLocaleString()}
                      </p>

                      <button 
                        type="button"
                        onClick={() => removeFromCart(item.productId)} 
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer & Totals Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-6 flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Quotation Prepared For (Customer)
                  </label>
                  <select 
                    value={selectedCustomerId} 
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">Walk-in Customer / Prospect</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.syncId}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Proposed Discount (Rs)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={discount} 
                    onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="md:col-span-6 bg-slate-50 border border-slate-200/90 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2 text-xs text-slate-600 font-medium">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-800">Rs {subtotal.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between items-center mb-2 text-xs text-rose-600 font-medium">
                      <span>Discount</span>
                      <span className="font-bold">- Rs {discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-200 pt-3 mb-4">
                    <span className="font-black text-slate-900 text-base">Total Estimate</span>
                    <span className="font-black text-2xl text-amber-600">
                      Rs {finalTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handlePrintQuote}
                  disabled={cart.length === 0}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm py-4 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> PRINT OFFICIAL QUOTATION
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
