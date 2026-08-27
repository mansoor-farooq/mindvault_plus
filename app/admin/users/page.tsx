"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import {
  Users, Search, MoreVertical, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, UserX, UserCheck, Crown, Loader2, X, Clock, Sparkles, KeyRound,
} from 'lucide-react';
import { adminApi, AdminUserRow, AdminApiError } from '@/lib/adminApi';
import { FEATURE_ACCESS_CATALOG } from '@/lib/featureAccess';

type StatusTab = 'All' | 'ACTIVE' | 'BANNED' | 'SUSPENDED';

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function isExpiredPro(user: AdminUserRow) {
  return user.license_type === 'PRO' && user.license_expiry && new Date(user.license_expiry) < new Date();
}

export default function UserListPage() {
  const { palette, mode } = useAdminTheme();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('All');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [statusModalUser, setStatusModalUser] = useState<AdminUserRow | null>(null);
  const [licenseModalUser, setLicenseModalUser] = useState<AdminUserRow | null>(null);
  const [permissionsModalUser, setPermissionsModalUser] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.users();
      setUsers(data.users);
    } catch {
      // handled inline per-row via empty state below
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredUsers = useMemo(() => users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesStatus = statusTab === 'All' ? true : u.account_status === statusTab;
    return matchesQuery && matchesStatus;
  }), [users, searchQuery, statusTab]);

  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.account_status === 'ACTIVE').length,
    banned: users.filter(u => u.account_status === 'BANNED').length,
    paid: users.filter(u => u.license_type === 'PRO' || u.license_type === 'LIFETIME').length,
  }), [users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">User Management</h1>
          <p className="text-xs text-gray-400">Ban, suspend, and manage licenses for every MindVault user</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard mode={mode} icon={<Users className="w-5 h-5" />} label="Total Users" value={counts.total} color={palette.primary} bg={palette.primaryLight} />
        <SummaryCard mode={mode} icon={<UserCheck className="w-5 h-5" />} label="Active" value={counts.active} color="#22c55e" bg="rgba(34,197,94,0.1)" />
        <SummaryCard mode={mode} icon={<UserX className="w-5 h-5" />} label="Banned" value={counts.banned} color="#ef4444" bg="rgba(239,68,68,0.1)" />
        <SummaryCard mode={mode} icon={<Crown className="w-5 h-5" />} label="Paid (PRO/LIFETIME)" value={counts.paid} color="#ffab00" bg="rgba(255,171,0,0.1)" />
      </div>

      <div className={`rounded-3xl border shadow-sm overflow-hidden ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
        {/* Filter Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1 flex-wrap">
            {(['All', 'ACTIVE', 'BANNED', 'SUSPENDED'] as StatusTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  statusTab === tab
                    ? 'text-white'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={statusTab === tab ? { backgroundColor: palette.primary } : {}}
              >
                {tab === 'All' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
            <Users className="w-8 h-8" />
            <p className="text-sm font-semibold">No users match this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">License</th>
                  <th className="py-3 px-4">Business</th>
                  <th className="py-3 px-4">Org</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 relative">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0" style={{ background: palette.accentGradient }}>
                          {initials(u.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold truncate">{u.full_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.role === 'SUPER_ADMIN' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                        : u.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                        : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                      }`}>
                        {u.role === 'SUPER_ADMIN' && <ShieldCheck className="w-3 h-3" />}
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.account_status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : u.account_status === 'BANNED' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}>
                        {u.account_status === 'ACTIVE' && <CheckCircle2 className="w-3 h-3" />}
                        {u.account_status === 'BANNED' && <XCircle className="w-3 h-3" />}
                        {u.account_status === 'SUSPENDED' && <AlertTriangle className="w-3 h-3" />}
                        {u.account_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.license_type === 'LIFETIME' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : u.license_type === 'PRO' ? (isExpiredPro(u) ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20')
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {u.license_type === 'LIFETIME' && <Crown className="w-3 h-3" />}
                          {u.license_type}
                        </span>
                        {u.license_type === 'PRO' && u.license_expiry && (
                          <span className={`text-[10px] flex items-center gap-1 ${isExpiredPro(u) ? 'text-rose-500 font-bold' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3" />
                            {isExpiredPro(u) ? 'Expired' : 'Expires'} {new Date(u.license_expiry).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.business_type ? (
                        <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-500/10 text-violet-500 border-violet-500/20">
                          {u.business_type.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.account_type === 'ORGANIZATION' ? (
                        <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          Org {u.org_role === 'OWNER' ? '(Owner)' : u.org_role === 'MEMBER' ? '(Member)' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 text-right relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenuId === u.id && (
                        <div className="absolute right-4 top-10 z-20 w-48 rounded-2xl shadow-2xl border bg-white dark:bg-[#161c24] border-gray-200 dark:border-gray-800 p-1.5 text-left">
                          <button
                            onClick={() => { setStatusModalUser(u); setActiveMenuId(null); }}
                            className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                          >
                            <UserX className="w-3.5 h-3.5 text-gray-400" /> Change Status
                          </button>
                          <button
                            onClick={() => { setLicenseModalUser(u); setActiveMenuId(null); }}
                            className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                          >
                            <Crown className="w-3.5 h-3.5 text-gray-400" /> Grant License
                          </button>
                          <button
                            onClick={() => { setPermissionsModalUser(u); setActiveMenuId(null); }}
                            className="w-full px-3 py-2 rounded-xl text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-gray-400" /> Permissions
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statusModalUser && (
        <StatusModal user={statusModalUser} onClose={() => setStatusModalUser(null)} onSaved={() => { setStatusModalUser(null); load(); }} />
      )}
      {licenseModalUser && (
        <LicenseModal user={licenseModalUser} onClose={() => setLicenseModalUser(null)} onSaved={() => { setLicenseModalUser(null); load(); }} />
      )}
      {permissionsModalUser && (
        <PermissionsModal user={permissionsModalUser} onClose={() => setPermissionsModalUser(null)} />
      )}
    </div>
  );
}

function SummaryCard({ mode, icon, label, value, color, bg }: {
  mode: string; icon: React.ReactNode; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: bg, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black">{value.toLocaleString()}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">{label}</p>
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#161c24] border border-gray-200 dark:border-gray-800 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusModal({ user, onClose, onSaved }: { user: AdminUserRow; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(user.account_status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateUserStatus(user.id, status);
      onSaved();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Change Status: ${user.full_name}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="text-xs font-semibold text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</div>}
        {(['ACTIVE', 'SUSPENDED', 'BANNED'] as const).map(opt => (
          <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${status === opt ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-200 dark:border-gray-800'}`}>
            <input type="radio" name="status" checked={status === opt} onChange={() => setStatus(opt)} className="accent-indigo-600" />
            <span className="text-xs font-bold">{opt.charAt(0) + opt.slice(1).toLowerCase()}</span>
          </label>
        ))}
        <button
          onClick={submit}
          disabled={saving || status === user.account_status}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-indigo-600 text-white font-bold text-sm rounded-xl py-2.5 hover:opacity-90 disabled:opacity-40 mt-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Status
        </button>
      </div>
    </ModalShell>
  );
}

function LicenseModal({ user, onClose, onSaved }: { user: AdminUserRow; onClose: () => void; onSaved: () => void }) {
  const [license, setLicense] = useState(user.license_type);
  const [durationDays, setDurationDays] = useState('30');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateUserLicense(user.id, license, license === 'PRO' ? parseInt(durationDays, 10) : undefined);
      onSaved();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to update license.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Grant License: ${user.full_name}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="text-xs font-semibold text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</div>}
        {(['FREE', 'PRO', 'LIFETIME'] as const).map(opt => (
          <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${license === opt ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-200 dark:border-gray-800'}`}>
            <input type="radio" name="license" checked={license === opt} onChange={() => setLicense(opt)} className="accent-indigo-600" />
            <span className="text-xs font-bold">{opt}</span>
          </label>
        ))}
        {license === 'PRO' && (
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Duration (days)</label>
            <input
              type="number" min="1" value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-indigo-600 text-white font-bold text-sm rounded-xl py-2.5 hover:opacity-90 disabled:opacity-40 mt-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save License
        </button>
      </div>
    </ModalShell>
  );
}

function PermissionsModal({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [access, setAccess] = useState<Record<string, boolean> | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.featureAccess(user.id).then((data) => setAccess(data.access)).catch(() => setError('Failed to load permissions.'));
  }, [user.id]);

  const toggle = async (featureKey: string, current: boolean) => {
    setPendingKey(featureKey);
    setError(null);
    try {
      const data = await adminApi.updateFeatureAccess(user.id, featureKey, !current);
      setAccess(data.access);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to update permission.');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <ModalShell title={`Permissions: ${user.full_name}`} onClose={onClose}>
      <div className="space-y-2">
        {error && <div className="text-xs font-semibold text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</div>}
        {!access ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          FEATURE_ACCESS_CATALOG.map((feature) => {
            const enabled = access[feature.key] ?? !feature.vip;
            return (
              <div key={feature.key} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{feature.label}</span>
                  {feature.vip && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      <Sparkles className="w-2.5 h-2.5" /> VIP
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggle(feature.key, enabled)}
                  disabled={pendingKey === feature.key}
                  className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}
