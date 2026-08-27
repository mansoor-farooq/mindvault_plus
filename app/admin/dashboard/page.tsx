"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminTheme } from '@/context/AdminThemeContext';
import { useAdminSession } from '@/context/AdminSessionContext';
import { SparklineChart, AreaChart, DonutChart, BarChart } from '@/components/admin/MinimalCharts';
import { adminApi, DashboardStats, AuditLogRow } from '@/lib/adminApi';
import {
  Users,
  StickyNote,
  Wallet,
  Store,
  Sparkles,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

function computeTrend(data: number[]): { percent: number; up: boolean } {
  if (data.length < 2) return { percent: 0, up: true };
  const mid = Math.ceil(data.length / 2);
  const earlier = data.slice(0, mid);
  const recent = data.slice(mid);
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (earlierAvg === 0) return { percent: recentAvg > 0 ? 100 : 0, up: true };
  const percent = ((recentAvg - earlierAvg) / earlierAvg) * 100;
  return { percent: Math.round(Math.abs(percent)), up: percent >= 0 };
}

function TrendBadge({ percent, up }: { percent: number; up: boolean }) {
  if (percent === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400">
        <Minus className="w-3 h-3" /> flat this week
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {percent}% vs earlier this week
    </span>
  );
}

function formatDay(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ACTION_LABELS: Record<string, string> = {
  USER_BLOCK: 'Banned user',
  USER_UNBLOCK: 'Unbanned user',
  USER_STATUS_CHANGE: 'Changed status',
  UPDATE_LICENSE: 'Updated license',
};

export default function AdminDashboardPage() {
  const { palette, mode } = useAdminTheme();
  const { me } = useAdminSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsData, logsData] = await Promise.all([
          adminApi.dashboardStats(),
          adminApi.auditLogs(6, 0),
        ]);
        if (cancelled) return;
        setStats(statsData);
        setRecentLogs(logsData.logs);
      } catch {
        if (!cancelled) setError('Could not load dashboard data. Is the backend running?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center gap-3">
        <AlertTriangle className="w-8 h-8 text-rose-500" />
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{error}</p>
      </div>
    );
  }

  const signupSparkline = stats.signupsLast7Days.map(d => d.count);
  const activeToday = stats.signupsLast7Days[stats.signupsLast7Days.length - 1]?.count || 0;
  const signupTrend = computeTrend(signupSparkline);

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div
        className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6"
        style={{ background: palette.accentGradient }}
      >
        <div className="space-y-3 z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome Back, {me?.name?.split(' ')[0] || 'Admin'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            MindVault Admin Dashboard
          </h1>
          <p className="text-sm opacity-90 leading-relaxed">
            {stats.totalUsers} total users &middot; {stats.licenseBreakdown.PRO + stats.licenseBreakdown.LIFETIME} on a paid plan &middot; {stats.statusBreakdown.BANNED} banned.
          </p>
        </div>

        <div className="relative z-10 hidden lg:flex items-center justify-center p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-white/20 text-white font-black text-xl">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <p className="text-xs font-bold">{me?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</p>
            <span className="text-[10px] opacity-80">Full system access</span>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard mode={mode} icon={<Users className="w-6 h-6" />} iconBg={palette.primaryLight} iconColor={palette.primary}
          label="Total Users" value={stats.totalUsers.toLocaleString()}
          sub={<TrendBadge percent={signupTrend.percent} up={signupTrend.up} />} />
        <KpiCard mode={mode} icon={<StickyNote className="w-6 h-6" />} iconBg="rgba(0,184,217,0.1)" iconColor="#00b8d9"
          label="Total Notes" value={stats.totalNotes.toLocaleString()}
          sub={<span className="text-[11px] text-gray-400">across all users</span>} />
        <KpiCard mode={mode} icon={<Wallet className="w-6 h-6" />} iconBg="rgba(255,171,0,0.1)" iconColor="#ffab00"
          label="Ledger Entries" value={stats.totalLedgerEntries.toLocaleString()}
          sub={<span className="text-[11px] text-gray-400">income &amp; expense records</span>} />
        <KpiCard mode={mode} icon={<Store className="w-6 h-6" />} iconBg="rgba(34,197,94,0.1)" iconColor="#22c55e"
          label="Khata Customers" value={stats.totalKhataCustomers.toLocaleString()}
          sub={<span className="text-[11px] text-gray-400">{activeToday} new signups today</span>} />
        <div className={`sm:col-span-2 lg:col-span-4 flex items-center gap-2 -mt-2 px-1`}>
          <SparklineChart data={signupSparkline.length > 1 ? signupSparkline : [0, 0]} color={palette.primary} />
          <span className="text-[10px] text-gray-400">Signup momentum, last 7 days</span>
        </div>
      </div>

      {/* Signups Area Chart & License Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="mb-6">
            <h3 className="font-bold text-lg">New Signups</h3>
            <p className="text-xs text-gray-400">Last 7 days</p>
          </div>
          <AreaChart
            categories={stats.signupsLast7Days.map(d => formatDay(d.date))}
            series={[{ name: 'New Users', data: stats.signupsLast7Days.map(d => d.count), color: palette.primary }]}
          />
        </div>

        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div>
            <h3 className="font-bold text-lg">License Breakdown</h3>
            <p className="text-xs text-gray-400 mb-6">FREE vs PRO vs LIFETIME</p>
            <DonutChart
              labels={['FREE', 'PRO', 'LIFETIME']}
              series={[stats.licenseBreakdown.FREE, stats.licenseBreakdown.PRO, stats.licenseBreakdown.LIFETIME]}
              colors={['#94a3b8', palette.primary, '#ffab00']}
            />
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <Link href="/admin/users" className="text-xs font-bold hover:underline" style={{ color: palette.primary }}>
              Manage Licenses &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Account Status Bar & Recent Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`p-6 rounded-3xl border shadow-sm ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="mb-6">
            <h3 className="font-bold text-lg">Account Status</h3>
            <p className="text-xs text-gray-400">Active vs banned vs suspended</p>
          </div>
          <BarChart
            categories={['Active', 'Banned', 'Suspended']}
            series={[{
              name: 'Users',
              data: [stats.statusBreakdown.ACTIVE, stats.statusBreakdown.BANNED, stats.statusBreakdown.SUSPENDED],
              color: palette.primary,
            }]}
          />
        </div>

        {/* Recent Audit Log */}
        <div className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg">Recent Admin Activity</h3>
              <p className="text-xs text-gray-400">Latest actions taken by admins</p>
            </div>
            <Link href="/admin/audit-logs" className="text-xs font-bold hover:underline" style={{ color: palette.primary }}>
              View All &rarr;
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No admin actions logged yet.</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl" style={{ backgroundColor: palette.primaryLight, color: palette.primary }}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{ACTION_LABELS[log.action] || log.action}</p>
                      <p className="text-[11px] text-gray-400">
                        {log.admin_name || 'System'} &rarr; {log.target_name || 'unknown user'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ mode, icon, iconBg, iconColor, label, value, sub }: {
  mode: string; icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; sub: React.ReactNode;
}) {
  return (
    <div className={`p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md ${mode === 'dark' ? 'bg-[#161c24] border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <h3 className="text-2xl font-black mt-1">{value}</h3>
        </div>
        <div className="p-3 rounded-2xl" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">{sub}</div>
    </div>
  );
}
