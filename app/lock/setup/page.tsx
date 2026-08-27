"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { useAuthStore } from '@/store/authStore';
import { ShieldCheck, Delete } from 'lucide-react';

export default function PinSetup() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const { user, login } = useAuthStore();

  const finish = useCallback(async (finalPin: string, firstPin: string) => {
    if (!user || !user.id) {
      router.push('/login');
      return;
    }
    if (finalPin !== firstPin) {
      setError('PINs do not match. Try again.');
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin('');
        setConfirmPin('');
        setStage('enter');
      }, 400);
      return;
    }
    try {
      const salt = bcrypt.genSaltSync(10);
      const pinHash = bcrypt.hashSync(finalPin, salt);
      await db.users.update(user.id, { pin: pinHash });
      login({ ...user, pin: pinHash });
      router.push('/');
    } catch (err: any) {
      setError('PIN setup failed: ' + err.message);
    }
  }, [user, login, router]);

  const pressDigit = (d: string) => {
    setError('');
    if (stage === 'enter') {
      if (pin.length >= 4) return;
      const next = pin + d;
      setPin(next);
      if (next.length === 4) {
        setTimeout(() => setStage('confirm'), 150);
      }
    } else {
      if (confirmPin.length >= 4) return;
      const next = confirmPin + d;
      setConfirmPin(next);
      if (next.length === 4) {
        setTimeout(() => finish(next, pin), 100);
      }
    }
  };

  const pressBackspace = () => {
    if (stage === 'enter') setPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  };

  if (!user) {
    return <div className="p-8 text-center text-gray-500">Redirecting to login...</div>;
  }

  const currentValue = stage === 'enter' ? pin : confirmPin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4">
      <div className="max-w-xs w-full flex flex-col items-center animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600 mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">{stage === 'enter' ? 'Set App Lock PIN' : 'Confirm your PIN'}</h1>
        <p className="text-sm text-gray-400 mb-8">
          {stage === 'enter' ? 'Choose a 4-digit PIN to secure your data' : 'Enter it again to confirm'}
        </p>

        <div className={`flex gap-4 mb-3 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < currentValue.length ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-gray-300'
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
      </div>
    </div>
  );
}
