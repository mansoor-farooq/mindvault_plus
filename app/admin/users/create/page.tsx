"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { UserPlus, ArrowLeft, Upload, CheckCircle2, ShieldCheck, Mail, Phone, Globe, User } from 'lucide-react';

export default function CreateUserPage() {
  const router = useRouter();
  const { palette, mode } = useAdminTheme();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: 'United States',
    role: 'Admin',
    status: 'Active',
    isVerified: true,
    bio: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push('/admin/users');
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Navigation Back Button */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Create New User Account</h1>
          <p className="text-xs text-gray-400">Fill in details to provision new team member or admin</p>
        </div>
      </div>

      {submitted && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span>User account created successfully! Redirecting to user list...</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avatar Upload Dropzone Card */}
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col items-center justify-center text-center ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="w-28 h-28 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-gray-50/50 dark:bg-gray-900/50">
            <Upload className="w-8 h-8 text-gray-400 mb-1" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Upload Photo</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">Allowed *.JPEG, *.PNG, *.GIF up to 5MB</p>

          <div className="mt-6 w-full pt-6 border-t border-gray-200 dark:border-gray-800 text-left space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Email Verified</span>
              <input
                type="checkbox"
                checked={formData.isVerified}
                onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                className="w-4 h-4 rounded text-primary"
              />
            </div>
          </div>
        </div>

        {/* User Details Inputs Card */}
        <div className={`md:col-span-2 p-6 rounded-3xl border shadow-sm space-y-6 ${
          mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <h3 className="font-bold text-lg border-b border-gray-200 dark:border-gray-800 pb-3">
            Account Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400">Full Name</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Sarah Jenkins"
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sarah@example.com"
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Country</label>
              <select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
              >
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Pakistan</option>
                <option>Germany</option>
                <option>Canada</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">System Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
              >
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Developer">Developer</option>
                <option value="User">User</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400">Initial Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none"
              >
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Banned">Banned</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400">User Bio / Notes</label>
            <textarea
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Brief description or admin notes about this user..."
              className="w-full mt-1.5 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold outline-none focus:border-primary"
            />
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <Link
              href="/admin/users"
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-transform hover:scale-105"
              style={{ background: palette.accentGradient }}
            >
              Create User Account
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
