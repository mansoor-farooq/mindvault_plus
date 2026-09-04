'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useParams, useRouter } from 'next/navigation';
import { Printer, MessageCircle, ArrowLeft, Sparkles } from 'lucide-react';

export default function InvoicePrintPage() {
  const params = useParams();
  const router = useRouter();
  const syncId = params.syncId as string;

  const invoice = useLiveQuery(() => db.invoices.where('syncId').equals(syncId).first(), [syncId]);

  if (invoice === undefined) {
    return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Loading Receipt...</div>;
  }

  if (invoice === null) {
    return <div className="p-10 text-center font-bold text-rose-500">Invoice not found!</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const itemsText = invoice.items.map(i => `- ${i.name} (x${i.quantity}) = Rs ${i.total}`).join('%0A');
    const msg = `*RECEIPT - ${invoice.invoiceNumber}*%0A%0ATotal: *Rs ${invoice.total}*%0A%0AItems:%0A${itemsText}%0A%0AThank you for your business!`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-10 print:py-0 print:bg-white">
      
      {/* Action Bar (Hidden in Print) */}
      <div className="w-full max-w-2xl bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center mb-6 print:hidden">
        <button onClick={() => router.back()} className="text-slate-500 hover:bg-slate-100 p-2 rounded-xl flex items-center gap-2 font-bold transition-colors">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex gap-3">
          <button onClick={handleWhatsApp} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <MessageCircle className="w-5 h-5" /> Send to WhatsApp
          </button>
          <button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-colors">
            <Printer className="w-5 h-5" /> Print PDF
          </button>
        </div>
      </div>

      {/* The Printable Receipt A4 / Thermal Styling */}
      <div className="w-full max-w-2xl bg-white p-10 sm:p-16 shadow-2xl rounded-sm print:shadow-none print:p-0 print:max-w-none">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Sparkles className="w-8 h-8" />
              <h1 className="text-3xl font-black tracking-tighter">MindVault.</h1>
            </div>
            <p className="text-slate-500 text-sm">123 Business Street, Tech City</p>
            <p className="text-slate-500 text-sm">Phone: +92 300 1234567</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-slate-200 uppercase tracking-widest mb-2">Receipt</h2>
            <p className="text-slate-800 font-bold">#{invoice.invoiceNumber}</p>
            <p className="text-slate-500 text-sm">{new Date(invoice.date).toLocaleDateString()} {new Date(invoice.date).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Customer Details */}
        <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Billed To</p>
          <p className="text-lg font-bold text-slate-800">{invoice.customerName}</p>
          <p className="text-sm font-bold mt-2 inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg">
            Payment Method: {invoice.paymentMethod}
          </p>
        </div>

        {/* Items Table */}
        <table className="w-full text-left mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800 text-slate-800">
              <th className="py-3 font-bold uppercase text-xs tracking-wider">Item Description</th>
              <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Qty</th>
              <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Price</th>
              <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Total</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {invoice.items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-4 font-semibold">{item.name}</td>
                <td className="py-4 text-center">{item.quantity}</td>
                <td className="py-4 text-right">Rs {item.unitPrice.toLocaleString()}</td>
                <td className="py-4 text-right font-bold">Rs {item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-1/2 min-w-[250px]">
            <div className="flex justify-between py-2 text-slate-600">
              <span>Subtotal</span>
              <span>Rs {invoice.subtotal.toLocaleString()}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between py-2 text-rose-500">
                <span>Discount</span>
                <span>- Rs {invoice.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-4 mt-2 border-t-2 border-slate-800 text-xl font-black text-indigo-900">
              <span>Total</span>
              <span>Rs {invoice.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-100 text-center text-slate-400 text-sm">
          <p className="font-bold text-slate-500 mb-1">Thank you for your business!</p>
          <p>Generated digitally via MindVault POS System</p>
        </div>

      </div>
    </div>
  );
}
