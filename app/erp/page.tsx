'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, InvoiceItem, Product } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { useAuthStore } from '@/store/authStore';
import { 
  ArrowLeft, Receipt, Presentation, Search, 
  ShoppingCart, Trash2, TrendingUp, BarChart3, Package, Minus, Plus,
  CreditCard, Wallet, UserCheck, FileText, CheckCircle2, Sparkles, Building2
} from 'lucide-react';
import Link from 'next/link';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

export default function ERPDashboardPage() {
  const user = useAuthStore((s) => s.user);
  // Queries
  const products = useLiveQuery(() => db.products.filter(p => !p.isDeleted).toArray(), []) || [];
  const customers = useLiveQuery(() => db.khataCustomers.filter(c => !c.isDeleted).toArray(), []) || [];
  const invoices = useLiveQuery(() => db.invoices.filter(i => !i.isDeleted).toArray(), []) || [];

  // POS State
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'KHATA' | 'BANK'>('CASH');

  // Chart Data Calculation
  const chartData = useMemo(() => {
    const data = [];
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date).toISOString().split('T')[0];
        return invDate === dateStr;
      });
      
      const revenue = dayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      data.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: revenue || 0
      });
    }
    return data;
  }, [invoices]);

  // Product Search Filter
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 6);

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

  const removeFromCart = (productId?: string) => {
    if (!productId) return;
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const updateQuantity = (productId?: string, delta?: number) => {
    if (!productId || !delta) return;
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
        .filter(Boolean) as InvoiceItem[]
    );
  };

  const handleGenerateInvoice = async () => {
    if (cart.length === 0) return;
    
    const customer = customers.find(c => c.syncId === selectedCustomerId);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const syncId = crypto.randomUUID();

    const newInvoice = {
      syncId,
      invoiceNumber,
      customerId: selectedCustomerId || undefined,
      customerName: customer ? customer.name : 'Walk-in Customer',
      items: cart,
      subtotal,
      discount,
      total: finalTotal,
      paymentMethod,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await db.invoices.add(newInvoice);

    // Auto-deduct inventory and log stock movements for sold items
    for (const item of cart) {
      if (item.productId) {
        await db.stockMovements.add({
          syncId: crypto.randomUUID(),
          productId: item.productId,
          type: 'STOCK_OUT',
          quantity: item.quantity,
          date: new Date().toISOString(),
          reason: `POS Sale - ${invoiceNumber}`,
          companyCode: user?.companyCode,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any);

        const prod = await db.products.where('syncId').equals(item.productId).first();
        if (prod && prod.id) {
          await db.products.update(prod.id, {
            stockQuantity: Math.max(0, (prod.stockQuantity || 0) - item.quantity),
            updatedAt: new Date()
          });
        }
      }
    }

    if (paymentMethod === 'KHATA' && selectedCustomerId) {
      await db.khataTransactions.add({
        syncId: crypto.randomUUID(),
        customerId: selectedCustomerId,
        type: 'GIVEN',
        amount: finalTotal,
        date: new Date().toISOString(),
        description: `Auto-added from Invoice ${invoiceNumber}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (customer) {
        await db.khataCustomers.update(customer.id!, {
          balance: (customer.balance || 0) + finalTotal,
          updatedAt: new Date().toISOString()
        });
      }
    }

    SyncService.sync();
    
    // Reset and redirect to the print page
    setCart([]);
    setDiscount(0);
    setSelectedCustomerId('');
    
    window.location.href = `/invoices/${syncId}`;
  };

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <main className="min-h-screen bg-slate-50/60 p-4 sm:p-8 pb-24 text-slate-800">
      {/* Executive SaaS Header Bar */}
      <div className="max-w-[1600px] w-full mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              <span className="text-indigo-600 font-bold">ERP Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                <Presentation className="w-6 h-6" />
              </span>
              ERP & Countertop POS
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link 
            href="/inventory" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition flex items-center gap-1.5"
          >
            <Package className="w-4 h-4 text-slate-400" />
            Inventory Stock
          </Link>
          <Link 
            href="/quotes" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            Takhmeena (Quotes)
          </Link>
          <Link 
            href="/khata" 
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4 text-slate-400" />
            Khata Register
          </Link>
        </div>
      </div>

      {/* Main Grid: POS Left, Luxury Analytics Right */}
      <div className="max-w-[1600px] w-full mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT PANEL: Point of Sale Biller */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 flex flex-col">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <ShoppingCart className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Point of Sale</h2>
                  <p className="text-xs text-slate-500">Scan SKU or search product name</p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                {cart.length} {cart.length === 1 ? 'item' : 'items'} in cart
              </span>
            </div>

            {/* Product Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type product name or SKU barcode..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              />
              
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
                        <span className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">{p.name}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          <span>•</span>
                          <span className={Number(p.stockQuantity) > 0 ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'}>
                            {Number(p.stockQuantity) > 0 ? `${p.stockQuantity} in stock` : 'Out of stock'}
                          </span>
                        </div>
                      </div>
                      <span className="text-indigo-600 font-black text-sm bg-indigo-50 px-2.5 py-1 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        Rs {Number(p.price).toLocaleString()}
                      </span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      No matching product found in stock catalog
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex flex-col gap-2.5 min-h-[220px] max-h-[340px] overflow-y-auto mb-6 p-1">
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12 border-2 border-dashed border-slate-200/80 rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                    <Package className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">Cart is empty</p>
                  <p className="text-xs text-slate-400 mt-0.5">Search products above to add them to this invoice</p>
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

            {/* Customer & Payment Tender Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Customer
                </label>
                <select 
                  value={selectedCustomerId} 
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.syncId}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Payment Method
                </label>
                <select 
                  value={paymentMethod} 
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all cursor-pointer"
                >
                  <option value="CASH">💵 Cash on Counter</option>
                  <option value="BANK">💳 Bank Transfer / Card</option>
                  <option value="KHATA">📒 Add to Udhaar Khata</option>
                </select>
              </div>
            </div>

            {/* Totals Breakdown & Checkout Button */}
            <div className="bg-slate-50 border border-slate-200/90 p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-2.5 text-xs text-slate-600 font-medium">
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} units)</span>
                <span className="font-bold text-slate-800">Rs {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mb-4 text-xs text-slate-600 font-medium">
                <span>Discount applied (Rs)</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    min="0"
                    value={discount} 
                    onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-24 bg-white border border-slate-200 rounded-lg py-1 px-2 text-right text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none shadow-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200 pt-3.5 mb-5">
                <span className="font-black text-slate-900 text-base">Grand Total</span>
                <span className="font-black text-2xl text-emerald-600">
                  Rs {finalTotal.toLocaleString()}
                </span>
              </div>

              <button 
                type="button"
                onClick={handleGenerateInvoice}
                disabled={cart.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm py-4 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Receipt className="w-5 h-5" /> GENERATE RECEIPT & INVOICE
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT PANEL: Executive ERP Analytics & Chart */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          
          {/* Top Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><TrendingUp className="w-4 h-4" /></span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">Rs {totalRevenue.toLocaleString()}</p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">Gross sales recorded</p>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Invoices</span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><Receipt className="w-4 h-4" /></span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{invoices.length}</p>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">Processed transactions</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catalog Items</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Package className="w-4 h-4" /></span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{products.length}</p>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">Active inventory SKUs</p>
              </div>
            </div>
          </div>

          {/* Main Revenue Velocity Chart */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm flex-1 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <BarChart3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">7-Day Revenue Velocity</h3>
                  <p className="text-xs text-slate-500">Daily breakdown of counter and online receipts</p>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Live Rolling Ledger
              </span>
            </div>
            
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevModern" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                    axisLine={{ stroke: '#e2e8f0' }} 
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => `Rs ${val}`} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderColor: '#e2e8f0', 
                      borderRadius: '16px', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      color: '#0f172a',
                      fontSize: '12px'
                    }}
                    itemStyle={{ color: '#4f46e5', fontWeight: 'bold' }}
                    formatter={(value: any) => [`Rs ${Number(value).toLocaleString()}`, 'Revenue']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorRevModern)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
