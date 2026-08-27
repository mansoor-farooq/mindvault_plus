"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { FileText, Download, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function InvoicesPage() {
  const { palette, mode } = useAdminTheme();

  const INVOICES = [
    { id: '#INV-4012', client: 'Acme Global Corp', date: 'Aug 18, 2026', dueDate: 'Sep 01, 2026', amount: '$4,850.00', status: 'Paid' },
    { id: '#INV-4013', client: 'Nexus Technologies', date: 'Aug 15, 2026', dueDate: 'Aug 30, 2026', amount: '$2,400.00', status: 'Pending' },
    { id: '#INV-4014', client: 'Starlight Media', date: 'Aug 01, 2026', dueDate: 'Aug 15, 2026', amount: '$1,250.00', status: 'Overdue' },
    { id: '#INV-4015', client: 'Apex Dynamics', date: 'Jul 28, 2026', dueDate: 'Aug 12, 2026', amount: '$8,900.00', status: 'Paid' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Invoices & Billing</h1>
        <p className="text-xs text-gray-400">Generate, review & download enterprise client statements</p>
      </div>

      <div className={`rounded-3xl border shadow-sm overflow-hidden ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                {INVOICES.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="py-3.5 px-4 font-bold text-primary">{inv.id}</td>
                    <td className="py-3.5 px-4 font-bold">{inv.client}</td>
                    <td className="py-3.5 px-4 text-gray-400">{inv.date}</td>
                    <td className="py-3.5 px-4 text-gray-400">{inv.dueDate}</td>
                    <td className="py-3.5 px-4 font-bold">{inv.amount}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : inv.status === 'Pending'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => alert(`Downloading ${inv.id} PDF...`)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                        title="Download PDF Invoice"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
