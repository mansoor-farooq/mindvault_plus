"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { ShieldCheck, Lock, Check, X, ShieldAlert } from 'lucide-react';

interface RolePermission {
  module: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export default function RolesPermissionsPage() {
  const { palette, mode } = useAdminTheme();
  const [selectedRole, setSelectedRole] = useState('Super Admin');

  const [permissions, setPermissions] = useState<RolePermission[]>([
    { module: 'User Management', create: true, read: true, update: true, delete: true },
    { module: 'Product Catalog', create: true, read: true, update: true, delete: false },
    { module: 'Financial Reports', create: true, read: true, update: false, delete: false },
    { module: 'System Settings', create: true, read: true, update: true, delete: true },
  ]);

  const togglePerm = (index: number, permType: 'create' | 'read' | 'update' | 'delete') => {
    setPermissions((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, [permType]: !item[permType] };
        }
        return item;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Roles & Permissions</h1>
        <p className="text-xs text-gray-400">Configure granular role-based access control (RBAC) security matrix</p>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { name: 'Super Admin', users: 2, color: '#7635dc' },
          { name: 'Manager', users: 5, color: '#00b8d9' },
          { name: 'Developer', users: 8, color: '#22c55e' },
          { name: 'User', users: 135, color: '#ffab00' },
        ].map((role) => (
          <div
            key={role.name}
            onClick={() => setSelectedRole(role.name)}
            className={`p-5 rounded-3xl border shadow-sm cursor-pointer transition-all ${
              selectedRole === role.name ? 'border-2 shadow-md' : 'border-gray-200 dark:border-gray-800'
            } ${mode === 'dark' ? 'bg-[#161c24]' : 'bg-white'}`}
            style={{ borderColor: selectedRole === role.name ? palette.primary : undefined }}
          >
            <div className="flex items-center justify-between">
              <ShieldCheck className="w-6 h-6" style={{ color: role.color }} />
              <span className="text-[10px] font-bold text-gray-400">{role.users} Accounts</span>
            </div>
            <h3 className="font-bold text-base mt-3">{role.name}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Full root access to all modules</p>
          </div>
        ))}
      </div>

      {/* Matrix Table */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
        mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Permission Matrix for &quot;{selectedRole}&quot;</h3>
          <button
            onClick={() => alert('Permissions updated!')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow"
            style={{ background: palette.accentGradient }}
          >
            Save Permissions Matrix
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                <th className="py-3 px-4">System Module</th>
                <th className="py-3 px-4 text-center">Create</th>
                <th className="py-3 px-4 text-center">Read</th>
                <th className="py-3 px-4 text-center">Update</th>
                <th className="py-3 px-4 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
              {permissions.map((p, idx) => (
                <tr key={p.module} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="py-3.5 px-4 font-bold">{p.module}</td>
                  {(['create', 'read', 'update', 'delete'] as const).map((key) => (
                    <td key={key} className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={p[key]}
                        onChange={() => togglePerm(idx, key)}
                        className="w-4 h-4 rounded text-primary border-gray-300 dark:border-gray-700 cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
