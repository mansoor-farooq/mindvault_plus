'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Shield, UserPlus, Trash2, Users } from 'lucide-react';
import bcrypt from 'bcryptjs';

export default function TeamPage() {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'CASHIER' | 'ADMIN'>('CASHIER');
  
  const isOwner = user?.accountType === 'ORGANIZATION' || user?.role === 'OWNER' || user?.role === 'ADMIN';

  const teamMembers = useLiveQuery(
    () => {
      if (!user?.companyCode) return [];
      return db.users.where('companyCode').equals(user.companyCode).toArray();
    },
    [user?.companyCode]
  ) || [];

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !user?.companyCode) return;
    
    const existing = await db.users.where('email').equalsIgnoreCase(email).first();
    if (existing) {
      alert('A user with this email already exists!');
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    await db.users.add({
      fullName: name,
      email,
      passwordHash,
      role,
      companyCode: user.companyCode,
      status: 'ACTIVE',
      createdAt: new Date() });

    setName('');
    setEmail('');
    setPassword('');
    alert('Team member created successfully!');
  };

  const handleRemoveMember = async (id: number) => {
    if (confirm('Are you sure you want to remove this member?')) {
      await db.users.delete(id);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-8 text-center bg-white shadow-sm rounded-xl m-8">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only Organization Owners and Admins can manage team members.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Team Access Control</h1>
          <p className="text-slate-500 text-sm">Create and manage accounts for your factory staff.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Add New Member
          </h2>
          <form onSubmit={handleCreateMember} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="e.g. Ali Raza" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="staff@minifactory.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Role</label>
              <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500 font-medium text-slate-700">
                <option value="CASHIER">Cashier (Sales only)</option>
                <option value="MANAGER">Manager (Inventory + Sales)</option>
                <option value="ADMIN">Admin (Full Access)</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 mt-2">
              Create Account
            </button>
          </form>
        </div>

        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 mb-4 px-2">Active Team Members ({teamMembers.length})</h2>
          {teamMembers.map(member => (
            <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold">
                  {member.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{member.fullName}</h3>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                  member.role === 'OWNER' || member.accountType === 'ORGANIZATION' 
                    ? 'bg-amber-50 text-amber-600 border-amber-200' 
                    : member.role === 'ADMIN' ? 'bg-purple-50 text-purple-600 border-purple-200'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}>
                  {member.role || (member.accountType === 'ORGANIZATION' ? 'OWNER' : 'USER')}
                </span>
                
                {member.accountType !== 'ORGANIZATION' && member.role !== 'OWNER' && (
                  <button onClick={() => handleRemoveMember(member.id!)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
