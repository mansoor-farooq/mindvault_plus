'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { useState } from 'react';
import AdModal from './AdModal';
import Link from 'next/link';
import { Sparkles, Crown, PlayCircle, ArrowUpRight } from 'lucide-react';

export default function QuotaWidget({ featureKey, title, freeLimit }: { featureKey: 'khata_customers' | 'products', title: string, freeLimit: number }) {
  const { user } = useAuthStore();
  const [showAdModal, setShowAdModal] = useState(false);

  // Get active count locally
  const activeCount = useLiveQuery(async () => {
    if (featureKey === 'khata_customers') {
      return await db.khataCustomers.filter(c => !c.isDeleted).count();
    } else if (featureKey === 'products') {
      return await db.products.filter(p => !p.isDeleted).count();
    }
    return 0;
  }, [featureKey]) ?? 0;

  // Get bonus quota from synced featureUsage
  const featureUsage = useLiveQuery(() => db.featureUsage.where('featureKey').equals(featureKey).first(), [featureKey]);
  const bonusQuota = featureUsage?.bonusQuota || 0;
  
  const isStarter = user?.license === 'STARTER';
  const isPro = user?.license === 'PRO';
  const isUltra = user?.license === 'PRO_PLUS' || user?.license === 'UNLIMITED' || user?.license === 'LIFETIME';
  
  let baseLimit = freeLimit;
  if (isStarter) {
    baseLimit = featureKey === 'khata_customers' ? 500 : 1000;
  } else if (isPro) {
    baseLimit = featureKey === 'khata_customers' ? 5000 : 10000;
  }
  
  const limit = baseLimit + bonusQuota;
  const limitReached = !isUltra && activeCount >= limit;
  const percentage = Math.min((activeCount / limit) * 100, 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm flex flex-col gap-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">{title} Capacity Quota</h3>
            <p className="text-[11px] text-slate-500 font-medium">Plan allowance and rewarded ad bonus slots</p>
          </div>
        </div>

        {isUltra ? (
          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs px-3 py-1 rounded-full font-bold">
            <Crown className="w-3.5 h-3.5 text-emerald-600" /> Unlimited (ULTRA / LIFETIME)
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-extrabold border ${
              limitReached
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : percentage > 80
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {isPro ? 'PRO Plan: ' : isStarter ? 'STARTER Plan: ' : 'FREE Plan: '}
              {activeCount} / {limit} slots used
            </span>
          </div>
        )}
      </div>
      
      {!isUltra && (
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              limitReached ? 'bg-rose-500' : percentage > 80 ? 'bg-amber-500' : 'bg-indigo-600'
            }`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {!isUltra && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
          <div className="text-slate-500">
            {limitReached ? (
              <span className="text-rose-600 font-bold">Limit reached! Upgrade or watch an ad to add more items.</span>
            ) : (
              <span>{Math.max(0, limit - activeCount)} slots remaining on your current plan.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdModal(true)}
              className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Watch Ad (+5 Slots)
            </button>
            <Link
              href="/upgrade"
              className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Upgrade Tier <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      <AdModal 
        isOpen={showAdModal} 
        onClose={() => setShowAdModal(false)} 
        featureKey={featureKey}
      />
    </div>
  );
}
