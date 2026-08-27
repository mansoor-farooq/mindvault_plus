'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Users, UserPlus, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface Member {
  id: number;
  full_name: string;
  email: string;
  org_role: 'OWNER' | 'MEMBER';
  created_at: string;
}

export default function TeamPage() {
  const token = useAuthStore((s) => s.token);
  const [isOrganization, setIsOrganization] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch('/api/team/members', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setIsOrganization(data.isOrganization);
        setIsOwner(data.isOwner);
        setMembers(data.members);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email: inviteEmail, password: invitePassword, fullName: inviteName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to invite member.');
        return;
      }
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      load();
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: number) => {
    if (!confirm('Remove this team member? They will become a separate individual account with no access to your shared data.')) return;
    await fetch('/api/team/remove', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId }),
    });
    load();
  };

  return (
    <main className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 flex items-center gap-3 shadow-lg shadow-indigo-200/50 sticky top-0 z-10">
        <Link href="/settings" className="p-2 hover:bg-white/15 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </Link>
        <h1 className="text-xl font-bold tracking-wide">Team</h1>
      </header>

      <div className="flex-1 p-4 max-w-lg w-full mx-auto flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading...
          </div>
        ) : !isOrganization ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center flex flex-col items-center gap-2">
            <Users className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              This is an Individual account. Team sharing is only available for Organization accounts (chosen at registration).
            </p>
          </div>
        ) : (
          <>
            {error && <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-3">{error}</div>}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-3">Team Members</h2>
              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-800">{m.full_name}</span>
                        {m.org_role === 'OWNER' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                            <ShieldCheck className="w-2.5 h-2.5" /> Owner
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                    {m.org_role === 'MEMBER' && isOwner && (
                      <button onClick={() => handleRemove(m.id)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isOwner && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Invite Team Member
                </h2>
                <form onSubmit={handleInvite} className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Full name"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    required
                    placeholder="Temporary password (8+ characters)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={inviting}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add Member
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
