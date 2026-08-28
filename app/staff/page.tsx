'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { SyncService } from '@/services/SyncService';
import { ArrowLeft, UserPlus, Briefcase, CalendarCheck, HandCoins, Users, ReceiptText, CircleCheck, CircleX, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function StaffManagerPage() {
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'ATTENDANCE' | 'PESHGI'>('EMPLOYEES');
  
  // Modals
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [showAddPeshgi, setShowAddPeshgi] = useState(false);

  // Forms
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empSalary, setEmpSalary] = useState('');

  const [peshgiEmpId, setPeshgiEmpId] = useState('');
  const [peshgiAmount, setPeshgiAmount] = useState('');
  const [peshgiDesc, setPeshgiDesc] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Queries
  const employees = useLiveQuery(() => db.employees.filter(e => e.isActive).toArray(), []) || [];
  const attendances = useLiveQuery(() => db.attendance.toArray(), []) || [];
  const advances = useLiveQuery(() => db.advances.filter(a => !a.isDeducted).toArray(), []) || [];

  const handleAddEmployee = async () => {
    if (!empName || !empSalary) return;
    await db.employees.add({
      name: empName,
      role: empRole || 'Worker',
      phone: empPhone,
      baseSalary: Number(empSalary),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    SyncService.sync();
    setShowAddEmp(false);
    setEmpName(''); setEmpRole(''); setEmpPhone(''); setEmpSalary('');
  };

  const handleAddPeshgi = async () => {
    if (!peshgiEmpId || !peshgiAmount) return;
    await db.advances.add({
      employeeId: peshgiEmpId,
      amount: Number(peshgiAmount),
      date: todayStr,
      description: peshgiDesc || 'Cash Advance (Peshgi)',
      isDeducted: false,
      createdAt: new Date()
    });
    SyncService.sync();
    setShowAddPeshgi(false);
    setPeshgiEmpId(''); setPeshgiAmount(''); setPeshgiDesc('');
  };

  const handleMarkAttendance = async (empId: string, status: 'PRESENT' | 'ABSENT' | 'HALF_DAY') => {
    const existing = attendances.find(a => a.employeeId === empId && a.date === selectedDate);
    if (existing) {
      await db.attendance.update(existing.id!, { status });
    } else {
      await db.attendance.add({ employeeId: empId, date: selectedDate, status, createdAt: new Date() });
    }
    SyncService.sync();
  };

  // Salary Calculations for the current month
  const currentMonthStr = selectedDate.substring(0, 7); // YYYY-MM
  const monthAttendances = attendances.filter(a => a.date.startsWith(currentMonthStr));
  
  const payroll = useMemo(() => {
    return employees.map(emp => {
      const empAtt = monthAttendances.filter(a => a.employeeId === emp.syncId);
      const absents = empAtt.filter(a => a.status === 'ABSENT').length;
      const halfDays = empAtt.filter(a => a.status === 'HALF_DAY').length;
      
      // Calculate deductions based on 30 day standard
      const perDaySalary = emp.baseSalary / 30;
      const attendanceDeduction = (absents * perDaySalary) + (halfDays * (perDaySalary / 2));
      
      const empAdvances = advances.filter(a => a.employeeId === emp.syncId);
      const totalPeshgi = empAdvances.reduce((sum, a) => sum + a.amount, 0);

      const netSalary = emp.baseSalary - attendanceDeduction - totalPeshgi;

      return {
        ...emp,
        perDaySalary,
        absents,
        halfDays,
        attendanceDeduction,
        totalPeshgi,
        netSalary: Math.max(0, netSalary)
      };
    });
  }, [employees, monthAttendances, advances]);

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-20">
      <header className="bg-gradient-to-r from-indigo-700 to-blue-800 text-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Briefcase className="w-5 h-5" /> Factory & Staff
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white px-4 border-b border-slate-200 flex justify-between sticky top-[68px] z-10 shadow-sm">
        <button onClick={() => setActiveTab('EMPLOYEES')} className={\py-4 font-bold text-sm border-b-2 transition-all \\}>Payroll</button>
        <button onClick={() => setActiveTab('ATTENDANCE')} className={\py-4 font-bold text-sm border-b-2 transition-all \\}>Attendance</button>
        <button onClick={() => setActiveTab('PESHGI')} className={\py-4 font-bold text-sm border-b-2 transition-all \\}>Peshgi</button>
      </div>

      <div className="p-4 max-w-3xl w-full mx-auto flex flex-col gap-6 mt-2">

        {/* EMPLOYEES & PAYROLL TAB */}
        {activeTab === 'EMPLOYEES' && (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <button onClick={() => setShowAddEmp(true)} className="bg-indigo-600 text-white font-bold p-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform">
              <UserPlus className="w-5 h-5" /> Register New Employee
            </button>

            {payroll.length === 0 ? (
              <div className="text-center p-10 bg-white border border-dashed border-slate-300 rounded-3xl mt-4">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No employees found. Add your factory staff to begin tracking.</p>
              </div>
            ) : (
              payroll.map(p => (
                <div key={p.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{p.name}</h3>
                      <p className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-full inline-block mt-1">{p.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Base Salary</p>
                      <p className="font-bold text-slate-700">Rs {p.baseSalary.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                      <p className="text-xs font-bold text-rose-500 mb-1 flex items-center gap-1"><CalendarCheck className="w-3 h-3"/> Absents</p>
                      <p className="font-semibold text-rose-900">{p.absents} Days (-Rs {Math.round(p.attendanceDeduction).toLocaleString()})</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <p className="text-xs font-bold text-amber-600 mb-1 flex items-center gap-1"><HandCoins className="w-3 h-3"/> Peshgi (Advance)</p>
                      <p className="font-semibold text-amber-900">Rs {p.totalPeshgi.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 rounded-xl text-white flex justify-between items-center shadow-lg shadow-emerald-100">
                    <div>
                      <p className="text-xs text-emerald-100 font-bold uppercase tracking-wider">Net Payable ({currentMonthStr})</p>
                      <p className="text-2xl font-black">Rs {Math.round(p.netSalary).toLocaleString()}</p>
                    </div>
                    <ReceiptText className="w-8 h-8 opacity-50" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'ATTENDANCE' && (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-indigo-500" /> Select Date</h2>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-sm font-medium outline-none focus:border-indigo-500" />
            </div>

            <div className="flex flex-col gap-3">
              {employees.map(emp => {
                const todaysAtt = attendances.find(a => a.employeeId === emp.syncId && a.date === selectedDate);
                const status = todaysAtt?.status || null;

                return (
                  <div key={emp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{emp.name}</h3>
                        <p className="text-xs text-slate-500">{emp.role}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                      <button 
                        onClick={() => handleMarkAttendance(emp.syncId!, 'PRESENT')}
                        className={\lex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all \\}
                      >Present</button>
                      <button 
                        onClick={() => handleMarkAttendance(emp.syncId!, 'HALF_DAY')}
                        className={\lex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all \\}
                      >Half</button>
                      <button 
                        onClick={() => handleMarkAttendance(emp.syncId!, 'ABSENT')}
                        className={\lex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all \\}
                      >Absent</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PESHGI TAB */}
        {activeTab === 'PESHGI' && (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <button onClick={() => setShowAddPeshgi(true)} className="bg-amber-500 text-white font-bold p-4 rounded-2xl shadow-lg shadow-amber-200 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform">
              <HandCoins className="w-5 h-5" /> Give Peshgi (Advance)
            </button>

            <div className="flex flex-col gap-3">
              {advances.map(adv => {
                const emp = employees.find(e => e.syncId === adv.employeeId);
                return (
                  <div key={adv.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800">{emp?.name || 'Unknown'}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <CalendarCheck className="w-3 h-3" /> {adv.date} • {adv.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-600">- Rs {adv.amount.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
              {advances.length === 0 && (
                <p className="text-center text-slate-400 p-8">No pending peshgi records.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddEmp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-indigo-500" /> New Employee
            </h2>
            
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Full Name</label>
              <input type="text" value={empName} onChange={e => setEmpName(e.target.value)} placeholder="e.g. Ali Ahmed" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Role</label>
                <input type="text" value={empRole} onChange={e => setEmpRole(e.target.value)} placeholder="e.g. Cutter" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Phone</label>
                <input type="text" value={empPhone} onChange={e => setEmpPhone(e.target.value)} placeholder="0300..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monthly Base Salary (Rs)</label>
              <input type="number" value={empSalary} onChange={e => setEmpSalary(e.target.value)} placeholder="e.g. 25000" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500" />
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddEmp(false)} className="flex-1 py-4 font-bold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleAddEmployee} className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">Register</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Peshgi Modal */}
      {showAddPeshgi && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <HandCoins className="w-6 h-6 text-amber-500" /> Give Peshgi
            </h2>
            
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Select Employee</label>
              <select value={peshgiEmpId} onChange={e => setPeshgiEmpId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-amber-500">
                <option value="">-- Choose Worker --</option>
                {employees.map(e => <option key={e.id} value={e.syncId}>{e.name} ({e.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Amount Given (Rs)</label>
              <input type="number" value={peshgiAmount} onChange={e => setPeshgiAmount(e.target.value)} placeholder="e.g. 2000" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Note / Reason</label>
              <input type="text" value={peshgiDesc} onChange={e => setPeshgiDesc(e.target.value)} placeholder="e.g. Medical emergency" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-amber-500" />
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddPeshgi(false)} className="flex-1 py-4 font-bold text-slate-600 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleAddPeshgi} className="flex-1 py-4 font-bold text-amber-900 bg-amber-400 rounded-xl shadow-lg shadow-amber-200">Save Advance</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
