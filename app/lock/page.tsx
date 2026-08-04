"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { useAuthStore } from '@/store/authStore';

export default function LockScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { user, unlock, logout, isUnlocked } = useAuthStore();

  useEffect(() => {
    if (!user) {
        router.push('/login');
    } else if (isUnlocked) {
        router.push('/');
    }
  }, [user, isUnlocked, router]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user || !user.pin) {
      router.push('/login');
      return;
    }

    const isMatch = bcrypt.compareSync(pin, user.pin);
    if (!isMatch) {
      setError('Incorrect PIN.');
      setPin('');
      return;
    }

    unlock();
    router.push('/');
  };

  if (!user || isUnlocked) {
    return null; // or loading spinner
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-indigo-900 mb-6">Welcome Back, {user.fullName.split(' ')[0]}</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-center">{error}</div>}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 text-center mb-2">Enter PIN to Unlock</label>
            <input
              type="password"
              maxLength={4}
              required
              autoFocus
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-center text-2xl tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 transition mt-4"
          >
            Unlock
          </button>
        </form>
        <button 
          onClick={() => {
            logout();
            router.push('/login');
          }}
          className="w-full text-gray-500 hover:text-gray-700 mt-4 text-sm"
        >
          Logout / Switch Account
        </button>
      </div>
    </div>
  );
}
