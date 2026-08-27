'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface QuizStatus {
  mindcoins: number;
  answeredToday: number;
  dailyLimit: number;
}

export default function MoneyToolsDashboardStats() {
  const token = useAuthStore((s) => s.token);
  const [status, setStatus] = useState<QuizStatus | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/games/status', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setStatus(data))
      .catch(() => {});
  }, [token]);

  if (!token) return null;

  const chartData = status
    ? [
        { label: 'Answered Today', value: status.answeredToday },
        { label: 'Daily Limit', value: status.dailyLimit },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">MindCoins Balance</span>
        {status === null ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        ) : (
          <span className="text-lg font-black text-amber-500">{status.mindcoins}</span>
        )}
      </div>

      {status && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Quiz Usage Today</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                <Cell fill="#f59e0b" />
                <Cell fill="#fde68a" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
