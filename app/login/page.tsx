"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import BannedScreen from '@/components/BannedScreen';
import { Sparkles, Loader2 } from 'lucide-react';

import { normalizeEmail } from '@/lib/utils';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { login } = useAuthStore();

  // Google's OAuth callback redirects back here with the result in the URL fragment
  // (never sent to the server, unlike a query string) - read it once, apply it, then
  // strip it from the address bar so a refresh/share doesn't re-expose the token.
  useEffect(() => {
    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const googleError = params.get('googleError');
    if (googleError) {
      setError(googleError);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    const token = params.get('googleToken');
    const userJson = params.get('googleUser');
    if (!token || !userJson) return;

    (async () => {
      try {
        const googleUser = JSON.parse(decodeURIComponent(userJson));
        const cleanEmail = normalizeEmail(googleUser.email);
        let user = await db.users.where('email').equalsIgnoreCase(cleanEmail).first();
        if (!user) {
          // Google accounts have no typed password - this local hash is never checked
          // against anything real, it only satisfies Dexie's own User shape.
          const passwordHash = bcrypt.hashSync(crypto.randomUUID(), bcrypt.genSaltSync(10));
          const newId = await db.users.add({
            fullName: googleUser.full_name || cleanEmail,
            email: cleanEmail,
            passwordHash,
            status: googleUser.status || 'ACTIVE',
            createdAt: new Date(),
          });
          user = await db.users.get(newId);
        } else {
          await db.users.where('email').equalsIgnoreCase(cleanEmail).modify({ status: googleUser.status || 'ACTIVE' });
          user.status = googleUser.status || 'ACTIVE';
        }
        window.history.replaceState(null, '', window.location.pathname);
        if (user) login(user, token);
      } catch {
        setError('Google sign-in succeeded but finishing setup failed - please try again.');
        window.history.replaceState(null, '', window.location.pathname);
      }
    })();
  }, [login]);

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const res = await fetch('/api/auth/google/start');
      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error || 'Google Sign-In is not available right now.');
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google Sign-In.');
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const cleanEmail = normalizeEmail(email);

    try {
      let user = await db.users.where('email').equalsIgnoreCase(cleanEmail).first();
      let token = '';

      // Check with backend if online to get latest ban status and JWT token
      if (navigator.onLine) {
        try {
          const res = await fetch(`/api/auth/login`, {
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

      // Navigation after this point is owned by AuthProvider (it reacts to the
      // user/isUnlocked state change from login() below and decides between
      // /lock/setup and / - a router.push() here as well would race it, and
      // AuthProvider's redirect always won, silently skipping PIN setup for
      // every new user).
      login(user, token);
    } catch (err: any) {
      setError('Login failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isBanned) {
    return <BannedScreen onBack={() => setIsBanned(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4">
      <div className="max-w-sm w-full animate-fade-in-up">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-400">Sign in to your MindVault</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 p-7">
          {error && <div className="bg-rose-50 text-rose-600 border border-rose-100 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Email</label>
              <input
                type="email"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Password</label>
              <input
                type="password"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm py-3 rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-white border border-gray-200 text-gray-700 font-semibold text-sm py-3 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {isGoogleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account? <Link href="/register" className="text-indigo-600 font-semibold hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
