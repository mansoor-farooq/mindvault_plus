"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { useAuthStore } from '@/store/authStore';

export default function PinSetup() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const { user, login } = useAuthStore();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user || !user.id) {
        router.push('/login');
        return;
    }

    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    try {
      const salt = bcrypt.genSaltSync(10);
      const pinHash = bcrypt.hashSync(pin, salt);

      await db.users.update(user.id, { pin: pinHash });
      
      // Update local store user
      login({ ...user, pin: pinHash });
      router.push('/');
    } catch (err: any) {
      setError('PIN setup failed: ' + err.message);
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Redirecting to login...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-indigo-900 mb-6">Set App Lock PIN</h2>
        <p className="text-center text-gray-600 text-sm mb-6">Enter a 4-digit PIN to secure your data.</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Enter PIN</label>
            <input
              type="password"
              maxLength={4}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-center text-xl tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm PIN</label>
            <input
              type="password"
              maxLength={4}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-center text-xl tracking-widest"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 transition mt-4"
          >
            Set PIN
          </button>
        </form>
      </div>
    </div>
  );
}
