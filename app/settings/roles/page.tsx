'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/PermissionGate';
import { CANONICAL_MODULES, CanonicalModuleKey, AccessLevel } from '@/lib/permissions/canonicalModules';
import {
  ShieldCheck,
  Shield,
  Users,
  History,
  Plus,
  Edit2,
  Trash2,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

interface RoleWithPermissions {
  id: string; // syncId
  name: string;
  description: string | null;
  isSystemDefault: boolean;
  memberCount: number;
  permissions: Record<CanonicalModuleKey, AccessLevel>;
}

interface TeamMemberAssignment {
  userId: number;
  fullName: string;
  email: string;
  orgRole: string | null;
  roleId: string | null;
  roleName: string;
  assignedAt: string;
}

interface AuditLogEntry {
  id: string;
  actorId: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: any;
  createdAt: string;
}

export default function RolesManagementPage() {
  const token = useAuthStore((s) => s.token);
  const { isOwner, hasAccess } = usePermissions();
  const canManageRoles = isOwner || hasAccess('team_management', 'full');

  const [activeTab, setActiveTab] = useState<'roles' | 'assignments' | 'audit'>('roles');

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [assignments, setAssignments] = useState<TeamMemberAssignment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal / Drawer state for creating/editing a role
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleNameInput, setRoleNameInput] = useState('');
  const [roleDescInput, setRoleDescInput] = useState('');
  const [matrixPermissions, setMatrixPermissions] = useState<Record<CanonicalModuleKey, AccessLevel>>(() => {
    const init: Record<string, AccessLevel> = {};
    CANONICAL_MODULES.forEach((m) => (init[m.key] = 'none'));
    return init as Record<CanonicalModuleKey, AccessLevel>;
  });
  const [isSavingRole, setIsSavingRole] = useState(false);

  // User Assignment modal state
  const [assigningUser, setAssigningUser] = useState<TeamMemberAssignment | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const fetchRolesData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, assignRes, auditRes] = await Promise.all([
        fetch('/api/roles', { headers: authHeaders }),
        fetch('/api/roles/assignments', { headers: authHeaders }),
        fetch('/api/roles/audit-logs', { headers: authHeaders })
      ]);

      if (!rolesRes.ok) throw new Error('Failed to load roles');
      if (!assignRes.ok) throw new Error('Failed to load team assignments');
      if (!auditRes.ok) throw new Error('Failed to load audit logs');

      const rolesData = await rolesRes.json();
      const assignData = await assignRes.json();
      const auditData = await auditRes.json();

      setRoles(rolesData.roles || []);
      setAssignments(assignData.assignments || []);
      setAuditLogs(auditData.logs || []);
    } catch (err: any) {
      setError(err.message || 'Error loading role management data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRolesData();
  }, [fetchRolesData]);

  const openCreateRoleModal = () => {
    setEditingRoleId(null);
    setRoleNameInput('');
    setRoleDescInput('');
    const init: Record<string, AccessLevel> = {};
    CANONICAL_MODULES.forEach((m) => (init[m.key] = 'none'));
    setMatrixPermissions(init as Record<CanonicalModuleKey, AccessLevel>);
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role: RoleWithPermissions) => {
    setEditingRoleId(role.id);
    setRoleNameInput(role.name);
    setRoleDescInput(role.description || '');
    setMatrixPermissions({ ...role.permissions });
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleNameInput.trim()) {
      setError('Role name is required');
      return;
    }

    setIsSavingRole(true);
    setError(null);

    try {
      const url = editingRoleId ? `/api/roles/${editingRoleId}` : '/api/roles';
      const method = editingRoleId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify({
          name: roleNameInput.trim(),
          description: roleDescInput.trim() || null,
          permissions: matrixPermissions
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save role');
      }

      setSuccessMessage(editingRoleId ? 'Role updated successfully' : 'Custom role created successfully');
      setIsRoleModalOpen(false);
      await fetchRolesData();
    } catch (err: any) {
      setError(err.message || 'Error saving role');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete role "${roleName}"?`)) return;

    setError(null);
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete role');
      }

      setSuccessMessage(`Role "${roleName}" deleted`);
      await fetchRolesData();
    } catch (err: any) {
      setError(err.message || 'Error deleting role');
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningUser || !selectedRoleId) return;

    setIsSavingAssignment(true);
    setError(null);

    try {
      const res = await fetch('/api/roles/assignments', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: assigningUser.userId,
          roleId: selectedRoleId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign role');
      }

      setSuccessMessage(`Role successfully updated for ${assigningUser.fullName || assigningUser.email}`);
      setAssigningUser(null);
      await fetchRolesData();
    } catch (err: any) {
      setError(err.message || 'Error assigning role');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  return (
    <PermissionGate moduleKey="team_management" minLevel="view" showLockNotice>
      <main className="min-h-screen bg-slate-50/50 p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  User Permission Gate (Layer 2)
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Per-user granular access control over all 13 canonical business modules.
              </p>
            </div>
          </div>

          {canManageRoles && activeTab === 'roles' && (
            <button
              onClick={openCreateRoleModal}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Create Custom Role
            </button>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="font-bold ml-4">
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="font-bold ml-4">
              ×
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold transition border-b-2 ${
              activeTab === 'roles'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            Roles & Matrix ({roles.length})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold transition border-b-2 ${
              activeTab === 'assignments'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            User Assignments ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold transition border-b-2 ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Audit Trail ({auditLogs.length})
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm">Loading roles and permissions matrix...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: ROLES & MATRIX */}
            {activeTab === 'roles' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{role.name}</h3>
                        {role.isSystemDefault ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            <Lock className="w-3 h-3" /> System Default
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                            Custom Role
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                        {role.description || 'No description provided.'}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded-lg">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          <strong className="text-slate-700">{role.memberCount}</strong> assigned team members
                        </span>
                      </div>

                      {/* Module mini-summary */}
                      <div className="space-y-1.5 mb-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Access Scope:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CANONICAL_MODULES.slice(0, 7).map((m) => {
                            const lvl = role.permissions[m.key] || 'none';
                            if (lvl === 'none') return null;
                            return (
                              <span
                                key={m.key}
                                className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                                  lvl === 'full'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}
                              >
                                {m.displayName}: {lvl}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                      {role.isSystemDefault ? (
                        <span className="text-xs text-slate-400 italic">Owner role permissions are immutable</span>
                      ) : (
                        canManageRoles && (
                          <>
                            <button
                              onClick={() => openEditRoleModal(role)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit Matrix
                            </button>
                            <button
                              onClick={() => handleDeleteRole(role.id, role.name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: USER ASSIGNMENTS */}
            {activeTab === 'assignments' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Org Role</th>
                        <th className="px-6 py-4">Assigned Role</th>
                        <th className="px-6 py-4">Last Updated</th>
                        {canManageRoles && <th className="px-6 py-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {assignments.map((u) => {
                        const isOrgOwner = u.orgRole === 'OWNER';
                        return (
                          <tr key={u.userId} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{u.fullName || 'No Name'}</div>
                              <div className="text-xs text-slate-400">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isOrgOwner ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {u.orgRole || 'MEMBER'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-indigo-600">{u.roleName}</span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {u.assignedAt ? new Date(u.assignedAt).toLocaleDateString() : 'N/A'}
                            </td>
                            {canManageRoles && (
                              <td className="px-6 py-4 text-right">
                                {isOrgOwner ? (
                                  <span className="text-xs text-slate-400 italic">Owner role immutable</span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAssigningUser(u);
                                      setSelectedRoleId(u.roleId || '');
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                                  >
                                    Reassign Role
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: AUDIT TRAIL */}
            {activeTab === 'audit' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No permission audit logs recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50"
                      >
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
                          <History className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{log.action.replace('_', ' ')}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Action by <strong className="text-slate-700">{log.actorName}</strong> (ID: {log.actorId}) on target{' '}
                            <span className="font-mono text-[11px] bg-slate-200 px-1 py-0.5 rounded">{log.targetType}</span>
                          </p>
                          {log.payload && (
                            <pre className="text-[11px] font-mono bg-white p-2 rounded-lg border border-slate-200 mt-2 text-slate-600 overflow-x-auto">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ROLE MATRIX MODAL */}
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h2 className="text-xl font-black text-slate-900">
                  {editingRoleId ? 'Edit Role Matrix' : 'Create Custom Role'}
                </h2>
                <button
                  onClick={() => setIsRoleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto py-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Head Accountant, Cashier"
                      value={roleNameInput}
                      onChange={(e) => setRoleNameInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Brief note on duties and access"
                      value={roleDescInput}
                      onChange={(e) => setRoleDescInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 13 Canonical Modules Matrix */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Module Permissions Matrix (13 Canonical Modules)
                    </label>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Ceiling rule: Subscription plan locks override role access</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    <div className="grid grid-cols-12 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-6">Module</div>
                      <div className="col-span-2 text-center">None</div>
                      <div className="col-span-2 text-center">View</div>
                      <div className="col-span-2 text-center">Full</div>
                    </div>

                    {CANONICAL_MODULES.map((mod) => {
                      const currentVal = matrixPermissions[mod.key] || 'none';
                      return (
                        <div
                          key={mod.key}
                          className="grid grid-cols-12 items-center px-4 py-3 hover:bg-slate-50/50 transition"
                        >
                          <div className="col-span-6">
                            <div className="font-bold text-sm text-slate-800">{mod.displayName}</div>
                            <div className="text-xs text-slate-400">{mod.description}</div>
                          </div>

                          <div className="col-span-2 flex justify-center">
                            <input
                              type="radio"
                              name={`perm_${mod.key}`}
                              checked={currentVal === 'none'}
                              onChange={() =>
                                setMatrixPermissions((prev) => ({ ...prev, [mod.key]: 'none' }))
                              }
                              className="w-4 h-4 text-slate-600 focus:ring-slate-500 cursor-pointer"
                            />
                          </div>

                          <div className="col-span-2 flex justify-center">
                            <input
                              type="radio"
                              name={`perm_${mod.key}`}
                              checked={currentVal === 'view'}
                              onChange={() =>
                                setMatrixPermissions((prev) => ({ ...prev, [mod.key]: 'view' }))
                              }
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </div>

                          <div className="col-span-2 flex justify-center">
                            <input
                              type="radio"
                              name={`perm_${mod.key}`}
                              checked={currentVal === 'full'}
                              onChange={() =>
                                setMatrixPermissions((prev) => ({ ...prev, [mod.key]: 'full' }))
                              }
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRoleModalOpen(false)}
                    className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRole}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm disabled:opacity-50"
                  >
                    {isSavingRole && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingRoleId ? 'Save Changes' : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* REASSIGN USER MODAL */}
        {assigningUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-lg font-black text-slate-900">Assign Role</h3>
                <button
                  onClick={() => setAssigningUser(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAssignRole} className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Target User:</p>
                  <p className="font-bold text-slate-900">
                    {assigningUser.fullName || assigningUser.email}
                  </p>
                  <p className="text-xs text-slate-400">{assigningUser.email}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Select Role *
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select a role...</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.isSystemDefault ? '(Owner Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAssigningUser(null)}
                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAssignment || !selectedRoleId}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50"
                  >
                    {isSavingAssignment && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </PermissionGate>
  );
}
