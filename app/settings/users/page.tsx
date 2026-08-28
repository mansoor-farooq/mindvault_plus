'use client';

import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Users, ShieldAlert, KeyRound, ShieldCheck, UserCog, Crown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function UsersSettingsPage() {
  const router = useRouter();
  const currentUser = useAuthStore(s => s.user);

  const handleTestRole = (role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER') => {
    useAuthStore.getState().updateUser({ role });
    if (role === 'CASHIER') router.push('/erp');
    else router.push('/');
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> App Users & Roles
          </h1>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-5xl mx-auto flex flex-col gap-6 w-full">
        
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0" />
          <div>
            <h2 className="text-rose-800 font-bold text-lg">Multi-Role Testing Mode</h2>
            <p className="text-rose-600 text-sm mt-1">
              You are currently logged in as: <b>{currentUser?.fullName} ({currentUser?.role || 'OWNER'})</b>.
              <br/><br/>
              Click any of the roles below to switch your account and see exactly what that specific staff member would see when they log into the app.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* OWNER */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center gap-3 border-t-4 border-t-amber-500">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
              <Crown className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Super Admin (OWNER)</h3>
              <p className="text-sm text-slate-500 mt-1">The supreme account. Has 100% full rights to the entire SaaS, can manage admins, and control the entire business.</p>
            </div>
            <button 
              onClick={() => handleTestRole('OWNER')}
              disabled={currentUser?.role === 'OWNER' || !currentUser?.role}
              className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentUser?.role === 'OWNER' || !currentUser?.role ? 'Currently Active' : 'Switch to OWNER'}
            </button>
          </div>

          {/* ADMIN */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center gap-3 border-t-4 border-t-indigo-600">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Admin</h3>
              <p className="text-sm text-slate-500 mt-1">Second in command. Has full rights to manage the software, staff, and settings, but operates under the Owner.</p>
            </div>
            <button 
              onClick={() => handleTestRole('ADMIN')}
              disabled={currentUser?.role === 'ADMIN'}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentUser?.role === 'ADMIN' ? 'Currently Active' : 'Switch to ADMIN'}
            </button>
          </div>

          {/* MANAGER */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center gap-3 border-t-4 border-t-emerald-500">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
              <UserCog className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Manager</h3>
              <p className="text-sm text-slate-500 mt-1">Can view Dashboards, Reports, manage Factory Staff, and use the POS. Cannot access the Settings or System Configuration.</p>
            </div>
            <button 
              onClick={() => handleTestRole('MANAGER')}
              disabled={currentUser?.role === 'MANAGER'}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentUser?.role === 'MANAGER' ? 'Currently Active' : 'Switch to MANAGER'}
            </button>
          </div>

          {/* CASHIER */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center gap-3 border-t-4 border-t-slate-800">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-slate-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Cashier / Sales Staff</h3>
              <p className="text-sm text-slate-500 mt-1">Lowest level. Can only access POS, Quotes, Inventory, and Khata. Completely blocked from Dashboards and Reports.</p>
            </div>
            <button 
              onClick={() => handleTestRole('CASHIER')}
              disabled={currentUser?.role === 'CASHIER'}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentUser?.role === 'CASHIER' ? 'Currently Active' : 'Switch to CASHIER'}
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}
