"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { useAuthStore } from '@/store/authStore';
import { Lock, Delete } from 'lucide-react';

export default function LockScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const { user, unlock, logout, isUnlocked } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (isUnlocked) {
      router.push('/');
    }
  }, [user, isUnlocked, router]);

  const tryUnlock = useCallback((fullPin: string) => {
    if (!user || !user.pin) {
      router.push('/login');
      return;
    }
    if (bcrypt.compareSync(fullPin, user.pin)) {
      unlock();
      router.push('/');
    } else {
      setError('Incorrect PIN');
      setShake(true);
      setTimeout(() => { setShake(false); setPin(''); }, 400);
    }
  }, [user, unlock, router]);

  const pressDigit = (d: string) => {
    if (pin.length >= 4) return;
    setError('');
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => tryUnlock(next), 100);
    }
  };

  const pressBackspace = () => setPin((p) => p.slice(0, -1));

  if (!user || isUnlocked) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4">
      <div className="max-w-xs w-full flex flex-col items-center animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600 mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">Welcome back, {user.fullName.split(' ')[0]}</h1>
        <p className="text-sm text-gray-400 mb-8">Enter your PIN to unlock</p>

        <div className={`flex gap-4 mb-3 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-gray-300'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-rose-500 font-medium h-4 mb-6">{error}</p>

        <div className="grid grid-cols-3 gap-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow-sm text-xl font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => pressDigit('0')}
            className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow-sm text-xl font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={pressBackspace}
            className="w-16 h-16 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => { logout(); router.push('/login'); }}
          className="text-gray-400 hover:text-gray-600 mt-10 text-sm font-medium transition-colors"
        >
          Logout / Switch Account
        </button>
      </div>
    </div>
  );
}
