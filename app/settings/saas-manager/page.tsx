'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Rocket, ShieldCheck, Database, KeyRound, Save } from 'lucide-react';
import Link from 'next/link';
import { TOOL_CATEGORIES } from '@/lib/toolCategories';

export default function SaaSManagerPage() {
  const { featureAccess, setFeatureAccess, user } = useAuthStore();
  const [localAccess, setLocalAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (featureAccess) {
      setLocalAccess(featureAccess);
    } else {
      const initial: Record<string, boolean> = {};
      TOOL_CATEGORIES.forEach(cat => {
        cat.tools.forEach(t => {
          if (t.featureKey) initial[t.featureKey] = true;
        });
      });
      setLocalAccess(initial);
    }
  }, [featureAccess]);

  const toggleFeature = (key: string) => {
    setLocalAccess(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveSettings = () => {
    setFeatureAccess(localAccess);
    alert('SaaS Modules Updated! Check the sidebar and dashboard to see the modules toggle instantly.');
  };

  const getCompanyCode = () => {
    if (user?.companyCode) return user.companyCode;
    return 'TENANT-' + Math.floor(1000 + Math.random() * 9000);
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-indigo-300" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-indigo-400" /> SaaS Subscription Manager
          </h1>
        </div>
        <button onClick={saveSettings} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/50 transition-colors">
          <Save className="w-4 h-4" /> Apply Licenses
        </button>
      </div>

      <div className="p-4 lg:p-8 max-w-4xl mx-auto flex flex-col gap-6 w-full">
        
        <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl flex items-start gap-4">
          <ShieldCheck className="w-8 h-8 text-indigo-600 shrink-0" />
          <div>
            <h2 className="text-indigo-900 font-bold text-lg">Super Admin Control Panel</h2>
            <p className="text-indigo-700 text-sm mt-1">
              Welcome, Mansoor. You are managing the SaaS subscriptions for:
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <div className="bg-white px-3 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-400" /> 
                <span className="text-xs font-bold text-slate-500 uppercase">Tenant Name</span>
                <span className="text-sm font-black text-slate-800">{user?.fullName || 'Demo Shop'}</span>
              </div>
              <div className="bg-white px-3 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-400" /> 
                <span className="text-xs font-bold text-slate-500 uppercase">Company Code</span>
                <span className="text-sm font-black text-slate-800">{getCompanyCode()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Manage Client Modules</h2>
          
          <div className="flex flex-col gap-8">
            {TOOL_CATEGORIES.map(cat => {
              if (cat.id === 'dashboard') return null;
              
              return (
                <div key={cat.id}>
                  <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <cat.icon className="w-4 h-4" /> {cat.label}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cat.tools.map(tool => {
                      if (!tool.featureKey) return null;
                      
                      const isEnabled = localAccess[tool.featureKey] !== false;
                      
                      return (
                        <div key={tool.featureKey} 
                          onClick={() => toggleFeature(tool.featureKey!)}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center ${
                            isEnabled ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <tool.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className={`font-bold ${isEnabled ? 'text-indigo-950' : 'text-slate-700'}`}>{tool.label}</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest">{tool.featureKey}</p>
                            </div>
                          </div>
                          
                          {/* Toggle Switch UI */}
                          <div className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                            isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                          }`}>
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </main>
  );
}
