'use client';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function NotesDashboardStats() {
  const notes = useLiveQuery(() => db.notes.filter((n) => !n.isDeleted).toArray()) || [];

  const totalNotes = notes.length;
  const favoriteNotes = notes.filter((n) => n.isFavorite).length;

  // Last 7 days, oldest first - same "generate the day buckets, then fill from real
  // records" approach the admin dashboard's signupsLast7Days already uses server-side.
  const last7Days = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const n of notes) {
      const key = new Date(n.createdAt).toISOString().slice(0, 10);
      const bucket = byKey.get(key);
      if (bucket) bucket.count += 1;
    }
    return days;
  }, [notes]);

  const hasAnyThisWeek = last7Days.some((d) => d.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-lg font-black text-gray-800">{totalNotes}</p>
          <p className="text-[10px] text-gray-400 font-semibold">Total Notes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-lg font-black text-gray-800">{favoriteNotes}</p>
          <p className="text-[10px] text-gray-400 font-semibold">Pinned</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Notes Created (Last 7 Days)</h3>
        {!hasAnyThisWeek ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-xs">No notes created this week yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={last7Days}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
