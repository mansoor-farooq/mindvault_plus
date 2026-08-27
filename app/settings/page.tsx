"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { ArrowLeft, HardDrive, Loader2, CheckCircle2, AlertTriangle, CloudUpload, Unlink, Building2, Save, Users } from 'lucide-react';
import Link from 'next/link';

interface DriveStatus {
  connected: boolean;
  connectedAt: string | null;
  lastBackupAt: string | null;
  configured: boolean;
}

type BusinessType = 'RETAIL_SHOP' | 'MANUFACTURING' | 'RESTAURANT' | 'WHOLESALE' | 'OTHER';

const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: 'RETAIL_SHOP', label: 'Retail Shop' },
  { value: 'MANUFACTURING', label: 'Mini Factory' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'OTHER', label: 'Other' },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const searchParams = useSearchParams();
  const driveParam = searchParams.get('drive');

  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [businessType, setBusinessType] = useState<BusinessType | undefined>(user?.businessType);
  const [savingBusinessType, setSavingBusinessType] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const saveBusinessType = async () => {
    if (!user || !businessType) return;
    setSavingBusinessType(true);
    try {
      if (user.id) {
        await db.users.update(user.id, { businessType });
      }
      updateUser({ businessType });
      await fetch('/api/auth/sync-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          fullName: user.fullName,
          country: user.country,
          city: user.city,
          religion: user.religion,
          namazRemindersEnabled: user.namazRemindersEnabled,
          businessType,
        }),
      });
      setMessage('Business type saved.');
    } finally {
      setSavingBusinessType(false);
    }
  };

  const loadStatus = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/drive/status`, { headers: authHeaders });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (driveParam === 'connected') setMessage('Google Drive connected successfully!');
    else if (driveParam === 'denied') setMessage('Google Drive connection was cancelled.');
    else if (driveParam) setMessage('Something went wrong connecting Google Drive. Please try again.');
  }, [driveParam]);

  const connect = async () => {
    if (!token) return;
    setConnecting(true);
    try {
      const res = await fetch(`/api/drive/connect`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Google Drive is not set up yet.');
        return;
      }
      window.location.href = data.authUrl;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    await fetch(`/api/drive/disconnect`, { method: 'POST', headers: authHeaders });
    loadStatus();
  };

  const backupNow = async () => {
    setBackingUp(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/drive/backup`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        setMessage('Backup failed. Please try again.');
        return;
      }
      setMessage(`Backed up to Drive as "${data.filename}"`);
      loadStatus();
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center justify-between shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/15 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-xl font-bold tracking-wide">Settings</h1>
        </div>
      </header>

      <div className="flex-1 p-4 max-w-lg w-full mx-auto flex flex-col gap-4">
        {message && (
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm rounded-xl p-3">{message}</div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-violet-50 text-violet-500">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Business Profile</h2>
              <p className="text-xs text-gray-400">Tell us what kind of business you run, so features can adapt</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
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

          <button
            onClick={saveBusinessType}
            disabled={savingBusinessType || !businessType || businessType === user?.businessType}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 w-full"
          >
            {savingBusinessType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Business Type
          </button>
        </div>

        <Link
          href="/settings/team"
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-3 hover:shadow-md transition-shadow"
        >
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-500">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-800">Team</h2>
            <p className="text-xs text-gray-400">Manage organization members (Organization accounts only)</p>
          </div>
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-500">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Google Drive Backup</h2>
              <p className="text-xs text-gray-400">Back up your notes, ledger, udhaar, bills and khata to your own Drive</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : !status?.configured ? (
            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Google Drive backup isn&apos;t set up on this server yet.
            </div>
          ) : status.connected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </div>
              {status.lastBackupAt && (
                <p className="text-xs text-gray-400">Last backup: {new Date(status.lastBackupAt).toLocaleString()}</p>
              )}
              <button
                onClick={backupNow}
                disabled={backingUp}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                Backup Now
              </button>
              <button
                onClick={disconnect}
                className="flex items-center justify-center gap-2 text-gray-500 text-xs font-semibold py-1.5"
              >
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 w-full"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              Connect Google Drive
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
