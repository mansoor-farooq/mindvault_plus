'use client';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { SyncService } from '@/services/SyncService';

export default function AdModal({ isOpen, onClose, featureKey }: { isOpen: boolean, onClose: () => void, featureKey: string }) {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleWatchAd = async () => {
    setLoading(true);
    setMessage('Initializing ad request...');

    try {
      // 1. Get Nonce from our backend
      const nonceRes = await fetch(`/api/ads/generate-nonce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ feature_key: featureKey })
      });

      if (!nonceRes.ok) throw new Error('Failed to start ad session');
      const { nonce } = await nonceRes.json();

      setMessage('Watching Sponsored Content...');
      // 2. Simulate watching ad for 3 seconds
      await new Promise(r => setTimeout(r, 3000));

      setMessage('Verifying reward...');
      // 3. Trigger our Next.js API route to simulate the Ad Provider webhook
      const simRes = await fetch('/api/simulate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, userId: user?.id, rewardAmount: 5 })
      });

      if (!simRes.ok) {
        const err = await simRes.json();
        throw new Error(err.error || 'Ad verification failed');
      }

      setMessage('Reward granted! Syncing data...');
      
      // 4. Force a sync so the frontend pulls the updated featureUsage table
      await SyncService.sync();

      setMessage('Success! You have earned bonus quota.');
      setTimeout(() => {
        setLoading(false);
        setMessage('');
        onClose();
      }, 2000);

    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 p-6 rounded-xl w-full max-w-sm flex flex-col items-center text-center">
        <h3 className="text-xl text-white font-bold mb-2">Unlock More Quota</h3>
        <p className="text-gray-400 text-sm mb-6">
          Watch a short sponsored video to instantly get +5 capacity for this feature, or upgrade to PRO for unlimited access.
        </p>

        {message && (
          <div className="mb-4 text-sm font-medium text-emerald-400">
            {message}
          </div>
        )}

        <div className="flex w-full gap-3">
          <button 
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleWatchAd}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Watch Ad'}
          </button>
        </div>
      </div>
    </div>
  );
}
