"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import BannedScreen from '@/components/BannedScreen';

import { normalizeEmail } from '@/lib/utils';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = normalizeEmail(email);

    try {
      let user = await db.users.where('email').equalsIgnoreCase(cleanEmail).first();
      let token = '';

      // Check with backend if online to get latest ban status and JWT token
      if (navigator.onLine) {
        try {
          const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password })
          });
          
          if (res.status === 403) {
            await db.users.where('email').equalsIgnoreCase(cleanEmail).modify({ status: 'BANNED' });
            if (user) user.status = 'BANNED';
            setIsBanned(true);
            return;
          }

          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              token = data.token;
            }
            const remoteStatus = (data.user?.status || 'ACTIVE') as 'ACTIVE' | 'BANNED';

            if (user) {
              await db.users.where('email').equalsIgnoreCase(cleanEmail).modify({ status: remoteStatus });
              user.status = remoteStatus;
            } else if (data.user) {
              // Create user entry in local Dexie on new device login
              const salt = bcrypt.genSaltSync(10);
              const passwordHash = bcrypt.hashSync(password, salt);
              const newId = await db.users.add({
                fullName: data.user.full_name || cleanEmail,
                email: cleanEmail,
                passwordHash,
                status: remoteStatus,
                createdAt: new Date()
              });
              user = await db.users.get(newId);
            }
          }
        } catch (err) {
          console.warn('Backend login check failed, falling back to local auth');
        }
      }

      if (!user) {
        setError('Invalid email or password.');
        return;
      }

      if (user.status === 'BANNED') {
        setIsBanned(true);
        return;
      }

      const isMatch = bcrypt.compareSync(password, user.passwordHash);
      if (!isMatch) {
        setError('Invalid email or password.');
        return;
      }

      login(user, token);

      if (!user.pin) {
        router.push('/lock/setup'); // Pin setup if first time
      } else {
        router.push('/'); // Or directly to home, app lock is handled globally
      }
    } catch (err: any) {
      setError('Login failed: ' + err.message);
    }
  };

  if (isBanned) {
    return <BannedScreen onBack={() => setIsBanned(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-center text-indigo-900 mb-6">Welcome Back</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 transition"
          >
            Login
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account? <Link href="/register" className="text-indigo-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
