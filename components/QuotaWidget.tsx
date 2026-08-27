'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { useState } from 'react';
import AdModal from './AdModal';

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
  
  const limit = freeLimit + bonusQuota;
  const isPro = user?.license === 'PRO' || user?.license === 'LIFETIME';
  const limitReached = !isPro && activeCount >= limit;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium">{title} Quota</h3>
        {isPro ? (
          <span className="text-emerald-400 text-xs px-2 py-1 bg-emerald-400/10 rounded-full font-medium">Unlimited (PRO)</span>
        ) : (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${limitReached ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
            {activeCount} / {limit}
          </span>
        )}
      </div>
      
      {!isPro && (
        <div className="w-full bg-white/10 rounded-full h-2 mt-2">
          <div 
            className={`h-2 rounded-full transition-all ${limitReached ? 'bg-red-500' : 'bg-blue-500'}`} 
            style={{ width: `${Math.min((activeCount / limit) * 100, 100)}%` }}
          />
        </div>
      )}

      {!isPro && limitReached && (
        <div className="mt-2 text-sm text-gray-400">
          Limit reached. <button onClick={() => setShowAdModal(true)} className="text-blue-400 hover:underline">Watch an Ad</button> to unlock more slots, or upgrade to PRO.
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
