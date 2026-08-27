"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import Link from 'next/link';
import { Sparkles, Loader2 } from 'lucide-react';

import { normalizeEmail } from '@/lib/utils';

const RELIGION_OPTIONS: { value: 'muslim' | 'other' | 'prefer_not_to_say'; label: string }[] = [
  { value: 'muslim', label: 'Muslim' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const BUSINESS_TYPE_OPTIONS: { value: 'RETAIL_SHOP' | 'MANUFACTURING' | 'RESTAURANT' | 'WHOLESALE' | 'OTHER'; label: string }[] = [
  { value: 'RETAIL_SHOP', label: 'Retail Shop' },
  { value: 'MANUFACTURING', label: 'Mini Factory' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'OTHER', label: 'Other' },
];

export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [religion, setReligion] = useState<'muslim' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [namazRemindersEnabled, setNamazRemindersEnabled] = useState(true);
  const [businessType, setBusinessType] = useState<'RETAIL_SHOP' | 'MANUFACTURING' | 'RESTAURANT' | 'WHOLESALE' | 'OTHER' | undefined>(undefined);
  const [accountType, setAccountType] = useState<'INDIVIDUAL' | 'ORGANIZATION'>('INDIVIDUAL');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignup = async () => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = normalizeEmail(email);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (accountType === 'ORGANIZATION' && !organizationName.trim()) {
      setError('Please enter your organization name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const existingUser = await db.users.where('email').equalsIgnoreCase(cleanEmail).first();
      if (existingUser) {
        setError('Email already exists. Please login.');
        return;
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      await db.users.add({
        fullName: fullName.trim(),
        email: cleanEmail,
        passwordHash,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        religion,
        namazRemindersEnabled: religion === 'muslim' ? namazRemindersEnabled : false,
        businessType,
        accountType,
        organizationName: accountType === 'ORGANIZATION' ? organizationName.trim() : undefined,
        createdAt: new Date(),
      });

      router.push('/login');
    } catch (err: any) {
      setError('Registration failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4 py-10">
      <div className="max-w-md w-full animate-fade-in-up">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
            Create Account
          </h1>
          <p className="text-sm text-gray-400">Join MindVault - your second brain</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 p-7">
          {error && <div className="bg-rose-50 text-rose-600 border border-rose-100 p-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-white border border-gray-200 text-gray-700 font-semibold text-sm py-3 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60 mb-5"
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
          <p className="text-[11px] text-gray-400 text-center mb-5 -mt-3">You can fill in country, business type etc. later from Settings.</p>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">OR REGISTER WITH EMAIL</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
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
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">Confirm</label>
                <input
                  type="password"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">Country</label>
                <input
                  type="text"
                  placeholder="e.g. Pakistan"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">City</label>
                <input
                  type="text"
                  placeholder="e.g. Lahore"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Religion (optional)</label>
              <div className="flex gap-2">
                {RELIGION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReligion(opt.value)}
                    className={`flex-1 px-2 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      religion === opt.value
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {religion === 'muslim' && (
                <label className="mt-2.5 flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={namazRemindersEnabled}
                    onChange={(e) => setNamazRemindersEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Enable Namaz (prayer) time reminders
                </label>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Business Type (optional)</label>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBusinessType(opt.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      businessType === opt.value
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Account Type</label>
              <div className="flex gap-2">
                {(['INDIVIDUAL', 'ORGANIZATION'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAccountType(opt)}
                    className={`flex-1 px-2 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      accountType === opt
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {opt === 'INDIVIDUAL' ? 'Individual' : 'Organization'}
                  </button>
                ))}
              </div>
              {accountType === 'ORGANIZATION' && (
                <input
                  type="text"
                  required
                  placeholder="Organization name"
                  className="mt-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              )}
              {accountType === 'ORGANIZATION' && (
                <p className="mt-1.5 text-[11px] text-gray-400">
                  You&apos;ll be the owner - invite team members later from Settings to share your business data with them.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm py-3 rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account? <Link href="/login" className="text-indigo-600 font-semibold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
