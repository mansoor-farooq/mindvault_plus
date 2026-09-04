'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { ArrowLeft, Download, Printer, FileText, Building2, Store, Users } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'SALES' | 'KHATA' | 'PAYROLL'>('SALES');

  // Load Data
  const invoices = useLiveQuery(() => db.invoices.filter(i => !i.isDeleted).toArray()) || [];
  const khataCustomers = useLiveQuery(() => db.khataCustomers.filter(c => !c.isDeleted).toArray()) || [];
  const employees = useLiveQuery(() => db.employees.filter(e => !e.isDeleted).toArray()) || [];
  const attendances = useLiveQuery(() => db.attendance.filter(a => !a.isDeleted).toArray()) || [];
  const advances = useLiveQuery(() => db.advances.filter(a => !a.isDeleted).toArray()) || [];

  // --- SALES SUMMARY ---
  const salesData = useMemo(() => {
    return invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      customerName: inv.customerName,
      paymentMethod: inv.paymentMethod,
      subtotal: inv.subtotal,
      discount: inv.discount,
      total: inv.total
    }));
  }, [invoices]);

  // --- KHATA SUMMARY ---
  const khataData = useMemo(() => {
    return khataCustomers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      balance: c.balance || 0,
      customerType: c.customerType || 'PERSON'
    }));
  }, [khataCustomers]);

  // --- PAYROLL SUMMARY ---
  const payrollData = useMemo(() => {
    return employees.map(emp => {
      const empAttendances = attendances.filter(a => a.employeeId === emp.syncId);
      const absents = empAttendances.filter(a => a.status === 'ABSENT').length;
      const empAdvances = advances.filter(adv => adv.employeeId === emp.syncId);
      const peshgi = empAdvances.reduce((sum, adv) => sum + adv.amount, 0);
      
      const perDaySalary = emp.baseSalary / 30;
      const deduction = absents * perDaySalary;
      const netSalary = Math.max(0, emp.baseSalary - deduction - peshgi);

      return {
        name: emp.name,
        role: emp.role,
        base: emp.baseSalary,
        absents,
        peshgi,
        netSalary: Math.round(netSalary)
      };
    });
  }, [employees, attendances, advances]);

  // --- EXPORT LOGIC ---
  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const dateStamp = new Date().toISOString().split('T')[0];
    if (activeTab === 'SALES') {
      const rows = salesData.map(inv => [
        inv.invoiceNumber,
        new Date(inv.date).toLocaleDateString(),
        inv.customerName || 'Walk-in',
        inv.paymentMethod,
        inv.subtotal.toString(),
        inv.discount.toString(),
        inv.total.toString()
      ]);
      downloadCSV(`sales_report_${dateStamp}.csv`, ['Invoice #', 'Date', 'Customer', 'Method', 'Subtotal', 'Discount', 'Total'], rows);
    } else if (activeTab === 'KHATA') {
      const rows = khataData.map(c => [
        c.name,
        c.phone || 'N/A',
        c.customerType,
        c.balance.toString()
      ]);
      downloadCSV(`khata_report_${dateStamp}.csv`, ['Customer Name', 'Phone', 'Type', 'Net Balance (Rs)'], rows);
    } else if (activeTab === 'PAYROLL') {
      const rows = payrollData.map(p => [
        p.name,
        p.role,
        p.base.toString(),
        p.absents.toString(),
        p.peshgi.toString(),
        p.netSalary.toString()
      ]);
      downloadCSV(`payroll_report_${dateStamp}.csv`, ['Employee Name', 'Role', 'Base Salary', 'Absents', 'Peshgi Deducted', 'Net Payable'], rows);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen print:bg-white">
      
      {/* Header (Hidden on Print) */}
      <div className="bg-white border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" /> Master Reports
          </h1>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('SALES')} 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'SALES' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" /> ERP Sales
          </button>
          <button 
            onClick={() => setActiveTab('KHATA')} 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'KHATA' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Store className="w-4 h-4" /> Khata
          </button>
          <button 
            onClick={() => setActiveTab('PAYROLL')} 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'PAYROLL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" /> Payroll
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <Printer className="w-4 h-4" /> Print PDF
          </button>
        </div>
      </div>

      {/* Printable Report Area */}
      <div className="p-4 lg:p-8 max-w-6xl w-full mx-auto print:p-0 print:max-w-none">
        
        {/* Print Only Header */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
          <h1 className="text-3xl font-black text-slate-900">MindVault Business Report</h1>
          <p className="text-slate-600 mt-1 font-bold">
            Type: {activeTab === 'SALES' ? 'ERP Sales & Revenue' : activeTab === 'KHATA' ? 'Market Khata (Receivables)' : 'Staff Payroll & Advances'}
          </p>
          <p className="text-sm text-slate-500">Generated on: {new Date().toLocaleString()}</p>
        </div>

        {/* --- SALES REPORT --- */}
        {activeTab === 'SALES' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 print:bg-slate-100">
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Invoice #</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Date</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Customer</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Payment</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesData.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No sales data available.</td></tr>
                ) : (
                  salesData.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-800">{inv.invoiceNumber}</td>
                      <td className="p-4 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="p-4 text-slate-600">{inv.customerName || 'Walk-in'}</td>
                      <td className="p-4 text-slate-600">{inv.paymentMethod}</td>
                      <td className="p-4 font-bold text-slate-800 text-right">Rs {inv.total.toLocaleString()}</td>
                    </tr>
                  ))
                )}
                {salesData.length > 0 && (
                  <tr className="bg-indigo-50/50 print:bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan={4} className="p-4 font-black text-slate-800 text-right uppercase">Grand Total Sales:</td>
                    <td className="p-4 font-black text-indigo-700 text-right text-lg">
                      Rs {salesData.reduce((sum, inv) => sum + inv.total, 0).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- KHATA REPORT --- */}
        {activeTab === 'KHATA' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 print:bg-slate-100">
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Customer Name</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Phone</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Type</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider text-right">Net Balance (Receivable)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {khataData.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">No Khata customers found.</td></tr>
                ) : (
                  khataData.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-800">{c.name}</td>
                      <td className="p-4 text-slate-600">{c.phone || '-'}</td>
                      <td className="p-4 text-slate-600">{c.customerType}</td>
                      <td className={`p-4 font-bold text-right ${c.balance > 0 ? 'text-rose-600' : c.balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {c.balance > 0 ? `Rs ${c.balance.toLocaleString()} (Pending)` : c.balance < 0 ? `Rs ${Math.abs(c.balance).toLocaleString()} (Advance)` : 'Cleared'}
                      </td>
                    </tr>
                  ))
                )}
                {khataData.length > 0 && (
                  <tr className="bg-rose-50/50 print:bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan={3} className="p-4 font-black text-slate-800 text-right uppercase">Total Market Credit (Pending):</td>
                    <td className="p-4 font-black text-rose-700 text-right text-lg">
                      Rs {khataData.reduce((sum, c) => c.balance > 0 ? sum + c.balance : sum, 0).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- PAYROLL REPORT --- */}
        {activeTab === 'PAYROLL' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 print:bg-slate-100">
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Employee Name</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider">Role</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider text-right">Base Salary</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider text-center">Absents</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider text-right">Peshgi (Advance)</th>
                  <th className="p-4 font-bold uppercase text-xs tracking-wider text-right">Net Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollData.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">No factory staff found.</td></tr>
                ) : (
                  payrollData.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-800">{p.name}</td>
                      <td className="p-4 text-slate-600">{p.role}</td>
                      <td className="p-4 text-right text-slate-600">Rs {p.base.toLocaleString()}</td>
                      <td className="p-4 text-center text-rose-600 font-bold">{p.absents}</td>
                      <td className="p-4 text-right text-amber-600 font-bold">Rs {p.peshgi.toLocaleString()}</td>
                      <td className="p-4 font-black text-emerald-600 text-right">Rs {p.netSalary.toLocaleString()}</td>
                    </tr>
                  ))
                )}
                {payrollData.length > 0 && (
                  <tr className="bg-emerald-50/50 print:bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan={5} className="p-4 font-black text-slate-800 text-right uppercase">Total Salary Expense this month:</td>
                    <td className="p-4 font-black text-emerald-700 text-right text-lg">
                      Rs {payrollData.reduce((sum, p) => sum + p.netSalary, 0).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </main>
  );
}
