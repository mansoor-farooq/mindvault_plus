"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { History, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { adminApi, AuditLogRow } from '@/lib/adminApi';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  USER_BLOCK: { label: 'Banned User', tone: 'warning' },
  USER_UNBLOCK: { label: 'Unbanned User', tone: 'success' },
  USER_STATUS_CHANGE: { label: 'Changed Status', tone: 'neutral' },
  UPDATE_LICENSE: { label: 'Updated License', tone: 'success' },
};

export default function AuditLogsPage() {
  const { mode } = useAdminTheme();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.auditLogs(PAGE_SIZE, p * PAGE_SIZE);
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      setError('Could not load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">System Audit Logs</h1>
        <p className="text-xs text-gray-400">Every ban, unban, status change, and license grant performed by an admin</p>
      </div>

      <div className={`rounded-3xl border shadow-sm overflow-hidden ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading logs...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
              <p className="text-sm font-semibold text-gray-500">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center text-gray-400">
              <History className="w-8 h-8" />
              <p className="text-sm font-semibold">No admin actions logged yet.</p>
              <p className="text-xs">Actions like banning a user or granting a license will show up here.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase font-bold text-[10px]">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Admin</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Target User</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                    {logs.map((log) => {
                      const meta = ACTION_LABELS[log.action] || { label: log.action, tone: 'neutral' as const };
                      const toneClass = meta.tone === 'success'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : meta.tone === 'warning'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-gray-500/10 text-gray-500 border-gray-500/20';
                      return (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="py-3.5 px-4 text-gray-400 font-mono whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold">{log.admin_name || 'Unknown'}</p>
                            <p className="text-[10px] text-gray-400">{log.admin_email}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${toneClass}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold">{log.target_name || 'Unknown'}</p>
                            <p className="text-[10px] text-gray-400">{log.target_email}</p>
                          </td>
                          <td className="py-3.5 px-4 text-gray-400">{log.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-6 mt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[11px] text-gray-400">
                  Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold">{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
